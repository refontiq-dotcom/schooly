begin;

alter table public.grade_corrections
  drop constraint if exists grade_corrections_request_id_fkey;
alter table public.grade_corrections
  add constraint grade_corrections_request_id_fkey
  foreign key (request_id) references public.grade_change_requests(id) on delete restrict;

create or replace function public.correct_evaluation_grade(
  p_school_id uuid, p_grade_id uuid, p_revision integer, p_value numeric,
  p_status text, p_comment text, p_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare g public.grade_entries; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  if not public.has_school_role(p_school_id, array['professeur']) then
    raise exception 'Seul le professeur peut corriger directement une note.' using errcode='42501';
  end if;
  select * into g from public.grade_entries where id=p_grade_id and school_id=p_school_id and deleted_at is null for update;
  if not found or not coalesce(public.can_access_evaluation_grade(g.school_id,g.enrollment_id,g.subject_id),false) then
    raise exception 'Note introuvable ou non autorisée.' using errcode='42501';
  end if;
  if p_revision is null or g.revision <> p_revision then
    raise exception 'Cette note a été modifiée. Rechargez avant de corriger.' using errcode='40001';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 2000 then
    raise exception 'Un motif de 1 à 2000 caractères est requis.';
  end if;
  if p_status is null or p_status not in ('graded','excused') or
    (p_status='excused' and p_value is not null) or
    (p_status='graded' and (p_value is null or not (p_value >= 0 and p_value <= g.max_value))) then
    raise exception 'Note ou statut invalide.';
  end if;
  if (g.value,g.absence_status,g.comment) is not distinct from (p_value,p_status,nullif(trim(p_comment),'')) then
    raise exception 'Aucune modification à enregistrer.';
  end if;
  update public.grade_entries set value=p_value, absence_status=p_status,
    comment=nullif(trim(p_comment),''), revision=g.revision+1 where id=g.id returning revision into next_revision;
  insert into public.grade_corrections(grade_id,school_id,revision,old_value,new_value,old_status,new_status,
    old_comment,new_comment,reason,corrected_by)
  values(g.id,g.school_id,next_revision,g.value,p_value,g.absence_status,p_status,
    g.comment,nullif(trim(p_comment),''),trim(p_reason),auth.uid());
  return next_revision;
end $$;

create or replace function public.decide_evaluation_grade_change(
  p_request_id uuid, p_approve boolean, p_decision_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare r public.grade_change_requests; g public.grade_entries; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  select * into r from public.grade_change_requests where id=p_request_id for update;
  if not found then raise exception 'Demande introuvable.' using errcode='42501'; end if;
  if not public.has_school_role(r.school_id, array['professeur']) then
    raise exception 'Seul un professeur peut confirmer ou refuser cette demande.' using errcode='42501';
  end if;
  if r.status <> 'pending' then raise exception 'Cette demande a déjà été traitée.'; end if;
  if r.requested_by = auth.uid() then raise exception 'Le demandeur ne peut pas approuver sa propre demande.' using errcode='42501'; end if;
  if not public.can_access_evaluation_grade(
    r.school_id,
    (select enrollment_id from public.grade_entries where id=r.grade_id),
    (select subject_id from public.grade_entries where id=r.grade_id)
  ) then raise exception 'Seul le professeur habilité peut confirmer cette correction.' using errcode='42501'; end if;

  if not p_approve then
    update public.grade_change_requests
      set status='rejected', decided_by=auth.uid(), decided_at=clock_timestamp(),
          decision_reason=nullif(trim(p_decision_reason),''), updated_at=clock_timestamp()
      where id=r.id;
    return r.old_revision;
  end if;

  select * into g from public.grade_entries where id=r.grade_id and deleted_at is null for update;
  if not found then raise exception 'Note introuvable.' using errcode='42501'; end if;
  if g.revision <> r.old_revision then
    raise exception 'La note a changé depuis la demande. La demande doit être recréée.' using errcode='40001';
  end if;
  if p_decision_reason is not null and length(trim(p_decision_reason)) > 2000 then
    raise exception 'Motif de décision trop long.';
  end if;

  update public.grade_entries
    set value=r.new_value, absence_status=r.new_status, comment=r.new_comment,
        revision=g.revision+1
    where id=g.id returning revision into next_revision;

  insert into public.grade_corrections(
    grade_id,school_id,revision,old_value,new_value,old_status,new_status,
    old_comment,new_comment,reason,corrected_by,request_id,requested_by
  ) values (
    g.id,g.school_id,next_revision,g.value,r.new_value,g.absence_status,r.new_status,
    g.comment,r.new_comment,r.reason,auth.uid(),r.id,r.requested_by
  );

  update public.grade_change_requests
    set status='approved', decided_by=auth.uid(), decided_at=clock_timestamp(),
        decision_reason=nullif(trim(p_decision_reason),''), applied_revision=next_revision,
        updated_at=clock_timestamp()
    where id=r.id;
  return next_revision;
end $$;

commit;
