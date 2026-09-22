-- Persistent in-app notifications for sensitive grade-change workflow.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in (
    'grade_change_request_pending',
    'grade_change_request_approved',
    'grade_change_request_rejected',
    'grade_modified_alert'
  )),
  title text not null,
  message text not null,
  href text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, school_id, read_at, created_at desc);
create index if not exists notifications_school_created_idx
  on public.notifications(school_id, created_at desc);
create index if not exists notifications_entity_idx
  on public.notifications(entity_id);

alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_grade_change_notification(
  p_user_id uuid,
  p_school_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_href text,
  p_entity_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare n_id uuid;
begin
  if p_user_id is null or p_school_id is null then
    raise exception 'Destinataire ou établissement invalide.';
  end if;
  if p_type not in (
    'grade_change_request_pending',
    'grade_change_request_approved',
    'grade_change_request_rejected',
    'grade_modified_alert'
  ) then
    raise exception 'Type de notification invalide.';
  end if;

  insert into public.notifications(user_id, school_id, type, title, message, href, entity_id)
  values (p_user_id, p_school_id, p_type, p_title, p_message, p_href, p_entity_id)
  returning id into n_id;

  return n_id;
end;
$$;

revoke all on function public.create_grade_change_notification(uuid,uuid,text,text,text,text,uuid) from public;
revoke execute on function public.create_grade_change_notification(uuid,uuid,text,text,text,text,uuid) from authenticated;

create or replace function public.get_notification_summary()
returns table(unread_count bigint, latest_created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where read_at is null),
    max(created_at)
  from public.notifications
  where user_id = auth.uid();
$$;

revoke all on function public.get_notification_summary() from public;
grant execute on function public.get_notification_summary() to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.notifications
     set read_at = coalesce(read_at, clock_timestamp())
   where id = p_notification_id
     and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare changed integer;
begin
  update public.notifications
     set read_at = clock_timestamp()
   where user_id = auth.uid()
     and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Notify the currently assigned professor(s), the requester and direction.
create or replace function public.notify_grade_change_request_created(
  p_request_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r public.grade_change_requests;
       g public.grade_entries;
       target record;
       requester_name text;
       student_name text;
       subject_name text;
       inserted_count integer := 0;
begin
  select * into r from public.grade_change_requests where id = p_request_id;
  if not found then raise exception 'Demande introuvable.'; end if;

  select * into g from public.grade_entries where id = r.grade_id;
  select coalesce(u.full_name, 'Informaticien') into requester_name
    from public.users u where u.id = r.requested_by;
  select trim(concat_ws(' ', s.first_name, s.last_name)) into student_name
    from public.enrollments e join public.students s on s.id=e.student_id
    where e.id=g.enrollment_id;
  select name into subject_name from public.subjects where id=g.subject_id;

  for target in
    select distinct a.teacher_id as user_id
      from public.enrollments e
      join public.class_subject_assignments a
        on a.class_id=e.class_id and a.school_id=e.school_id
       and a.subject_id=g.subject_id and a.deleted_at is null
      join public.user_school_roles usr
        on usr.user_id=a.teacher_id and usr.school_id=g.school_id
       and usr.role_code='professeur' and usr.is_active
     where e.id=g.enrollment_id and e.school_id=g.school_id and e.deleted_at is null
  loop
    perform public.create_grade_change_notification(
      target.user_id, r.school_id, 'grade_change_request_pending',
      'Nouvelle demande de modification de note',
      coalesce(student_name,'Élève') || ' · ' || coalesce(subject_name,'Matière') ||
      ' : une demande informatique attend votre confirmation.',
      '/dashboard/pedagogie/grades', r.id);
    inserted_count := inserted_count + 1;
  end loop;

  -- Direction receives an audit-level notification.
  for target in
    select usr.user_id
      from public.user_school_roles usr
     where usr.school_id=r.school_id
       and usr.role_code='direction' and usr.is_active
  loop
    perform public.create_grade_change_notification(
      target.user_id, r.school_id, 'grade_change_request_pending',
      'Demande de modification de note',
      coalesce(requester_name,'Informatique') || ' a créé une demande pour ' ||
      coalesce(student_name,'un élève') || ' · ' || coalesce(subject_name,'une matière') ||
      '. La confirmation reste réservée au professeur habilité.',
      '/dashboard/direction/grade-audit', r.id);
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.notify_grade_change_request_created(uuid) from public;
revoke execute on function public.notify_grade_change_request_created(uuid) from authenticated;

-- Patch the existing request function: create the request, then fan out persistent notifications.
create or replace function public.request_evaluation_grade_change(
  p_school_id uuid, p_grade_id uuid, p_value numeric, p_status text, p_comment text, p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare g public.grade_entries; req_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  if not public.has_school_role(p_school_id, array['informatique']) then
    raise exception 'Seul le service informatique peut demander cette correction.' using errcode='42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 2000 then
    raise exception 'Un motif de 1 à 2000 caractères est requis.';
  end if;

  select * into g from public.grade_entries
   where id=p_grade_id and school_id=p_school_id and deleted_at is null for update;
  if not found then raise exception 'Note introuvable.' using errcode='42501'; end if;
  if p_status not in ('graded','excused')
     or (p_status='excused' and p_value is not null)
     or (p_status='graded' and (p_value is null or p_value < 0 or p_value > g.max_value)) then
    raise exception 'Note ou statut invalide.';
  end if;
  if (g.value,g.absence_status,g.comment) is not distinct from
     (p_value,p_status,nullif(trim(p_comment),'')) then
    raise exception 'Aucune modification à demander.';
  end if;
  if exists (select 1 from public.grade_change_requests r where r.grade_id=g.id and r.status='pending') then
    raise exception 'Une demande de correction est déjà en attente.';
  end if;

  insert into public.grade_change_requests(
    school_id,grade_id,requested_by,old_revision,old_value,old_status,old_comment,
    new_value,new_status,new_comment,reason
  ) values (
    g.school_id,g.id,auth.uid(),g.revision,g.value,g.absence_status,g.comment,
    p_value,p_status,nullif(trim(p_comment),''),trim(p_reason)
  ) returning id into req_id;

  perform public.notify_grade_change_request_created(req_id);
  return req_id;
end;
$$;

-- Replace the decision function so the outcome is persisted and routed to IT + direction.
create or replace function public.decide_evaluation_grade_change(
  p_request_id uuid, p_approve boolean, p_decision_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r public.grade_change_requests; g public.grade_entries; next_revision integer;
        decision_label text; student_name text; subject_name text; target record;
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
  if p_decision_reason is not null and length(trim(p_decision_reason)) > 2000 then
    raise exception 'Motif de décision trop long.';
  end if;

  if not p_approve then
    update public.grade_change_requests
      set status='rejected', decided_by=auth.uid(), decided_at=clock_timestamp(),
          decision_reason=nullif(trim(p_decision_reason),''), updated_at=clock_timestamp()
      where id=r.id;
    decision_label := 'refusée';
  else
    select * into g from public.grade_entries where id=r.grade_id and deleted_at is null for update;
    if not found then raise exception 'Note introuvable.' using errcode='42501'; end if;
    if g.revision <> r.old_revision then
      raise exception 'La note a changé depuis la demande. La demande doit être recréée.' using errcode='40001';
    end if;

    update public.grade_entries
      set value=r.new_value, absence_status=r.new_status, comment=r.new_comment, revision=g.revision+1
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
    decision_label := 'confirmée';
  end if;

  select trim(concat_ws(' ', s.first_name, s.last_name)) into student_name
    from public.grade_entries ge
    join public.enrollments e on e.id=ge.enrollment_id
    join public.students s on s.id=e.student_id
   where ge.id=r.grade_id;
  select name into subject_name from public.subjects
   where id=(select subject_id from public.grade_entries where id=r.grade_id);

  -- Notify the informaticien who initiated the request.
  perform public.create_grade_change_notification(
    r.requested_by, r.school_id,
    case when p_approve then 'grade_change_request_approved' else 'grade_change_request_rejected' end,
    case when p_approve then 'Modification de note confirmée' else 'Modification de note refusée' end,
    coalesce(student_name,'Élève') || ' · ' || coalesce(subject_name,'Matière') ||
      ' : votre demande a été ' || decision_label ||
      coalesce(' — ' || nullif(trim(p_decision_reason),''), '.'),
    '/dashboard/informatique/grade-change-requests', r.id);

  -- Direction gets the outcome as a read-only audit event.
  for target in
    select usr.user_id
      from public.user_school_roles usr
     where usr.school_id=r.school_id and usr.role_code='direction' and usr.is_active
  loop
    perform public.create_grade_change_notification(
      target.user_id, r.school_id,
      case when p_approve then 'grade_change_request_approved' else 'grade_change_request_rejected' end,
      case when p_approve then 'Modification de note confirmée' else 'Modification de note refusée' end,
      coalesce(student_name,'Élève') || ' · ' || coalesce(subject_name,'Matière') ||
        ' : demande ' || decision_label || '. Consultez le journal en lecture seule.',
      '/dashboard/direction/grade-audit', r.id);
  end loop;

  return coalesce(next_revision, r.old_revision);
end;
$$;

revoke all on function public.request_evaluation_grade_change(uuid,uuid,numeric,text,text,text) from public;
grant execute on function public.request_evaluation_grade_change(uuid,uuid,numeric,text,text,text) to authenticated;
revoke all on function public.decide_evaluation_grade_change(uuid,boolean,text) from public;
grant execute on function public.decide_evaluation_grade_change(uuid,boolean,text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then
    null;
  end;
end $$;
