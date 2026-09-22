begin;

alter table public.grade_corrections
  add column if not exists request_id uuid,
  add column if not exists requested_by uuid references public.users(id);

create table if not exists public.grade_change_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_id uuid not null references public.grade_entries(id) on delete restrict,
  requested_by uuid not null references public.users(id),
  requested_at timestamptz not null default clock_timestamp(),
  old_revision integer not null,
  old_value numeric,
  old_status text not null,
  old_comment text,
  new_value numeric,
  new_status text not null check (new_status in ('graded','excused')),
  new_comment text,
  reason text not null check (length(trim(reason)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  decision_reason text,
  applied_revision integer,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (new_status <> 'excused' or new_value is null),
  check (new_status <> 'graded' or (new_value is not null and new_value >= 0))
);

create index if not exists idx_grade_change_requests_school_status on public.grade_change_requests(school_id,status);
create index if not exists idx_grade_change_requests_grade on public.grade_change_requests(grade_id);
create index if not exists idx_grade_change_requests_requester on public.grade_change_requests(requested_by);

alter table public.grade_change_requests enable row level security;

drop policy if exists grade_change_requests_read on public.grade_change_requests;
create policy grade_change_requests_read on public.grade_change_requests
for select to authenticated
using (
  public.is_super_admin()
  or (requested_by = auth.uid() and public.is_school_member(school_id))
  or (
    public.is_school_member(school_id)
    and exists (
      select 1 from public.grade_entries g
      where g.id = grade_change_requests.grade_id
        and g.school_id = grade_change_requests.school_id
        and public.can_access_evaluation_grade(g.school_id,g.enrollment_id,g.subject_id)
    )
  )
  or public.has_school_role(school_id, array['direction'])
);

revoke all on public.grade_change_requests from anon, authenticated;
grant select on public.grade_change_requests to authenticated;

create or replace function public.request_evaluation_grade_change(
  p_school_id uuid, p_grade_id uuid, p_value numeric, p_status text,
  p_comment text, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
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
  return req_id;
end $$;

create or replace function public.list_pending_grade_change_requests(p_school_id uuid)
returns table (
  id uuid, grade_id uuid, requested_by uuid, requested_at timestamptz,
  old_revision integer, old_value numeric, old_status text, old_comment text,
  new_value numeric, new_status text, new_comment text, reason text, status text
) language sql security definer set search_path = public as $$
  select r.id,r.grade_id,r.requested_by,r.requested_at,r.old_revision,
         r.old_value,r.old_status,r.old_comment,r.new_value,r.new_status,
         r.new_comment,r.reason,r.status
  from public.grade_change_requests r
  where r.school_id=p_school_id and r.status='pending'
    and (
      public.has_school_role(p_school_id, array['direction','super_admin'])
      or public.has_school_role(p_school_id, array['informatique'])
      or exists (
        select 1 from public.grade_entries g
        where g.id=r.grade_id
          and public.can_access_evaluation_grade(g.school_id,g.enrollment_id,g.subject_id)
      )
    )
  order by r.requested_at desc
$$;

create or replace function public.decide_evaluation_grade_change(
  p_request_id uuid, p_approve boolean, p_decision_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare r public.grade_change_requests; g public.grade_entries; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  select * into r from public.grade_change_requests where id=p_request_id for update;
  if not found then raise exception 'Demande introuvable.' using errcode='42501'; end if;
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

  select * into g from public.grade_entries
    where id=r.grade_id and deleted_at is null for update;
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

revoke all on function public.request_evaluation_grade_change(uuid,uuid,numeric,text,text,text) from public,anon;
revoke all on function public.list_pending_grade_change_requests(uuid) from public,anon;
revoke all on function public.decide_evaluation_grade_change(uuid,boolean,text) from public,anon;
grant execute on function public.request_evaluation_grade_change(uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.list_pending_grade_change_requests(uuid) to authenticated;
grant execute on function public.decide_evaluation_grade_change(uuid,boolean,text) to authenticated;

commit;
