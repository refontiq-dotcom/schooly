-- ============================================================================
-- SCHOOLY v1 — Équipe (RH/Staff) intelligence
-- ============================================================================
-- Ajoute au module Équipe :
--   * vue effectif par rôle / établissement ;
--   * vue membres inactifs (pas d'action > 30j) ;
--   * vue stats par établissement (taux encadrement, etc.) ;
--   * vue engagement parents (nb enfants, messages, paiements) ;
--   * fonction d'export équipe.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : effectif par rôle et établissement
-- ----------------------------------------------------------------------------
create or replace view public.team_overview as
select
  establishment_id,
  role,
  count(*) as member_count,
  count(*) filter (where created_at > current_date - interval '30 days') as new_members_30d,
  count(*) filter (where created_at > current_date - interval '7 days') as new_members_7d
from public.profiles
where establishment_id is not null
group by establishment_id, role
order by establishment_id, role;

grant select on public.team_overview to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : membres inactifs (>30j sans action)
-- ----------------------------------------------------------------------------
create or replace view public.team_inactive_members as
with last_grade as (
  select recorded_by as user_id, max(created_at) as last_action_at
  from public.grades
  group by recorded_by
),
last_attendance as (
  select recorded_by as user_id, max(created_at) as last_action_at
  from public.attendance_records
  group by recorded_by
),
last_payment as (
  select recorded_by as user_id, max(created_at) as last_action_at
  from public.payments
  group by recorded_by
),
last_message as (
  select sender_id as user_id, max(created_at) as last_action_at
  from public.messages
  group by sender_id
),
last_reservation as (
  select confirmed_by as user_id, max(created_at) as last_action_at
  from public.reservations
  where confirmed_by is not null
  group by confirmed_by
),
all_actions as (
  select user_id, last_action_at from last_grade
  union all select user_id, last_action_at from last_attendance
  union all select user_id, last_action_at from last_payment
  union all select user_id, last_action_at from last_message
  union all select user_id, last_action_at from last_reservation
),
max_per_user as (
  select user_id, max(last_action_at) as last_action_at
  from all_actions
  group by user_id
)
select
  p.id as user_id,
  p.establishment_id,
  p.full_name,
  p.role,
  p.email,
  p.phone,
  p.created_at,
  mpu.last_action_at,
  case when mpu.last_action_at is null then null
    else extract(day from (now() - mpu.last_action_at))::int
  end as days_inactive,
  case
    when mpu.last_action_at is null then 'never'
    when now() - mpu.last_action_at > interval '90 days' then 'critical'
    when now() - mpu.last_action_at > interval '30 days' then 'inactive'
    when now() - mpu.last_action_at > interval '14 days' then 'low_activity'
    else 'active'
  end as activity_status
from public.profiles p
left join max_per_user mpu on mpu.user_id = p.id
where p.establishment_id is not null
  and p.role in ('admin', 'professeur', 'secretariat', 'censeur');

grant select on public.team_inactive_members to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : stats par établissement (taux encadrement, alertes)
-- ----------------------------------------------------------------------------
create or replace view public.team_establishment_stats as
with counts as (
  select
    establishment_id,
    count(*) filter (where role = 'admin') as admin_count,
    count(*) filter (where role = 'professeur') as teacher_count,
    count(*) filter (where role = 'secretariat') as secretariat_count,
    count(*) filter (where role = 'censeur') as censeur_count,
    count(*) filter (where role = 'parent') as parent_count,
    count(*) as total_members
  from public.profiles
  where establishment_id is not null
  group by establishment_id
),
students_count as (
  select establishment_id, count(*) as cnt
  from public.students
  group by establishment_id
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(c.admin_count, 0) as admin_count,
  coalesce(c.teacher_count, 0) as teacher_count,
  coalesce(c.secretariat_count, 0) as secretariat_count,
  coalesce(c.censeur_count, 0) as censeur_count,
  coalesce(c.parent_count, 0) as parent_count,
  coalesce(c.total_members, 0) as total_members,
  coalesce(sc.cnt, 0) as students_count,
  case when coalesce(c.teacher_count, 0) = 0 then null
    else round(coalesce(sc.cnt, 0)::numeric / c.teacher_count, 1)
  end as students_per_teacher_ratio,
  case
    when coalesce(c.admin_count, 0) = 0 then 'missing_admin'
    when coalesce(c.teacher_count, 0) = 0 then 'missing_teachers'
    when coalesce(c.secretariat_count, 0) = 0 then 'missing_secretariat'
    else 'complete'
  end as staffing_status
from public.establishments e
left join counts c on c.establishment_id = e.id
left join students_count sc on sc.establishment_id = e.id;

grant select on public.team_establishment_stats to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : engagement parents
-- ----------------------------------------------------------------------------
create or replace view public.team_parent_engagement as
select
  p.id as parent_id,
  p.establishment_id,
  p.full_name as parent_name,
  p.email,
  p.phone,
  count(distinct s.id) as children_count,
  count(distinct m.id) as messages_received,
  count(distinct m.id) filter (where m.read_at is not null) as messages_read,
  coalesce((
    select count(*) from public.payments pay
    join public.student_fees sf on sf.id = pay.student_fee_id
    where sf.student_id in (select id from public.students where parent_id = p.id)
      and pay.status = 'confirmed'
  ), 0) as payments_confirmed,
  case
    when count(distinct s.id) = 0 then 'no_children'
    when count(distinct m.id) = 0 and count(distinct s.id) > 0 then 'silent'
    when count(distinct m.id) filter (where m.read_at is not null)::numeric / nullif(count(distinct m.id), 0) >= 0.8 then 'engaged'
    else 'normal'
  end as engagement_level
from public.profiles p
left join public.students s on s.parent_id = p.id
left join public.messages m on m.recipient_id = p.id
where p.role = 'parent' and p.establishment_id is not null
group by p.id, p.establishment_id, p.full_name, p.email, p.phone;

grant select on public.team_parent_engagement to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : export équipe (résumé JSON)
-- ----------------------------------------------------------------------------
create or replace function public.export_team_summary(
  p_establishment_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'establishment_id', p_establishment_id,
    'stats', (select to_jsonb(s.*) from public.team_establishment_stats s where establishment_id = p_establishment_id),
    'roles_breakdown', (
      select jsonb_agg(jsonb_build_object('role', role, 'count', member_count))
      from public.team_overview
      where establishment_id = p_establishment_id
    ),
    'inactive_count', (
      select count(*) from public.team_inactive_members
      where establishment_id = p_establishment_id and activity_status in ('inactive', 'critical')
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.export_team_summary(uuid) to authenticated, service_role;
