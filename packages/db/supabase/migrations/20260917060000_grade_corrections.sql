-- Lot 3 : corrections atomiques et journal. Après les lots 1 et 2.
begin;
alter table public.grade_entries add column revision integer not null default 1 check (revision > 0);
create table public.grade_corrections (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grade_entries(id) on delete restrict,
  school_id uuid not null references public.schools(id),
  revision integer not null,
  old_value numeric, new_value numeric,
  old_status text not null, new_status text not null,
  old_comment text, new_comment text,
  reason text not null check (length(trim(reason)) between 1 and 2000),
  corrected_by uuid not null references public.users(id),
  corrected_at timestamptz not null default clock_timestamp(),
  unique(grade_id,revision)
);
alter table public.grade_corrections enable row level security;
create policy grade_corrections_read on public.grade_corrections for select to authenticated
  using (exists (select 1 from public.grade_entries g where g.id=grade_id and g.school_id=grade_corrections.school_id
    and public.can_access_evaluation_grade(g.school_id,g.enrollment_id,g.subject_id)));
revoke all on public.grade_corrections from anon, authenticated;
grant select on public.grade_corrections to authenticated;
-- Aucune correction ni suppression directe depuis l'API.
revoke update,delete on public.grade_entries from authenticated,anon;

create function public.correct_evaluation_grade(
  p_school_id uuid, p_grade_id uuid, p_revision integer, p_value numeric,
  p_status text, p_comment text, p_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare g public.grade_entries; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
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
  -- Les triggers existants contrôlent période, inscription et métadonnées.
  update public.grade_entries set value=p_value, absence_status=p_status,
    comment=nullif(trim(p_comment),''), revision=g.revision+1 where id=g.id returning revision into next_revision;
  insert into public.grade_corrections(grade_id,school_id,revision,old_value,new_value,old_status,new_status,
    old_comment,new_comment,reason,corrected_by)
  values(g.id,g.school_id,next_revision,g.value,p_value,g.absence_status,p_status,
    g.comment,nullif(trim(p_comment),''),trim(p_reason),auth.uid());
  return next_revision;
end $$;
revoke all on function public.correct_evaluation_grade(uuid,uuid,integer,numeric,text,text,text) from public,anon;
grant execute on function public.correct_evaluation_grade(uuid,uuid,integer,numeric,text,text,text) to authenticated;
commit;
