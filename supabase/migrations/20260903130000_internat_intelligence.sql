-- ============================================================================
-- SCHOOLY v1 — Internat intelligent
-- ============================================================================
-- Ajoute au module Internat :
--   * vue agrégée temps réel (occupation, incidents 7j/30j, repas servis) ;
--   * résumé incidents par élève (détection des élèves problématiques) ;
--   * résumé santé par élève (suivi température, médication) ;
--   * fonction de suggestion de lit (rotation optimale) ;
--   * tendances d'occupation 90 jours ;
--   * couverture repas (présents vs servis).
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : dashboard internat temps réel
-- ----------------------------------------------------------------------------
create or replace view public.internat_dashboard as
with beds_stats as (
  select
    b.establishment_id,
    count(*) as total_beds,
    count(*) filter (where bd.status = 'occupe') as occupied_beds,
    count(*) filter (where bd.status = 'libre') as free_beds,
    count(*) filter (where bd.status = 'maintenance') as maintenance_beds
  from public.internat_blocks b
  left join public.internat_rooms r on r.block_id = b.id
  left join public.internat_beds bd on bd.room_id = r.id
  group by b.establishment_id
),
incidents_7 as (
  select establishment_id, count(*) as cnt
  from public.internat_incidents
  where incident_date > current_date - interval '7 days'
  group by establishment_id
),
incidents_30 as (
  select establishment_id, count(*) as cnt
  from public.internat_incidents
  where incident_date > current_date - interval '30 days'
  group by establishment_id
),
incidents_grave_open as (
  select establishment_id, count(*) as cnt
  from public.internat_incidents
  where severity = 'grave' and resolved_at is null
  group by establishment_id
),
visits_today as (
  select s.establishment_id, count(*) as cnt
  from public.internat_visits v
  join public.students s on s.id = v.student_id
  where v.visit_date = current_date
  group by s.establishment_id
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(bs.total_beds, 0) as total_beds,
  coalesce(bs.occupied_beds, 0) as occupied_beds,
  coalesce(bs.free_beds, 0) as free_beds,
  coalesce(bs.maintenance_beds, 0) as maintenance_beds,
  case when coalesce(bs.total_beds, 0) = 0 then 0
    else round(100.0 * coalesce(bs.occupied_beds, 0) / bs.total_beds)
  end as occupancy_rate_pct,
  coalesce(i7.cnt, 0) as incidents_7d,
  coalesce(i30.cnt, 0) as incidents_30d,
  coalesce(ig.cnt, 0) as grave_open_incidents,
  coalesce(vt.cnt, 0) as visits_today
from public.establishments e
left join beds_stats bs on bs.establishment_id = e.id
left join incidents_7 i7 on i7.establishment_id = e.id
left join incidents_30 i30 on i30.establishment_id = e.id
left join incidents_grave_open ig on ig.establishment_id = e.id
left join visits_today vt on vt.establishment_id = e.id;

grant select on public.internat_dashboard to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : élèves problématiques (incidents multiples)
-- ----------------------------------------------------------------------------
create or replace view public.internat_students_at_risk as
select
  s.id as student_id,
  s.establishment_id,
  s.full_name,
  sec.name as section_name,
  ib.name as block_name,
  ir.number as room_number,
  count(*) filter (where i.severity = 'mineur') as incidents_mineur,
  count(*) filter (where i.severity = 'majeur') as incidents_majeur,
  count(*) filter (where i.severity = 'grave') as incidents_grave,
  count(*) filter (where i.resolved_at is null) as incidents_open,
  max(i.incident_date) as last_incident_date,
  max(i.incident_date) filter (where i.resolved_at is null and i.severity = 'grave') as last_grave_open_date,
  case
    when count(*) filter (where i.severity = 'grave' and i.resolved_at is null) > 0 then 'critical'
    when count(*) filter (where i.incident_date > current_date - interval '30 days') >= 3 then 'high'
    when count(*) filter (where i.severity in ('majeur', 'grave') and i.incident_date > current_date - interval '30 days') >= 2 then 'medium'
    else 'low'
  end as risk_level
from public.students s
left join public.internat_assignments ia on ia.student_id = s.id and ia.status = 'actif'
left join public.internat_beds ibd on ibd.id = ia.bed_id
left join public.internat_rooms ir on ir.id = ibd.room_id
left join public.internat_blocks ib on ib.id = ir.block_id
left join public.sections sec on sec.id = s.section_id
left join public.internat_incidents i on i.student_id = s.id
group by s.id, s.establishment_id, s.full_name, sec.name, ib.name, ir.number
having count(i.id) > 0;

grant select on public.internat_students_at_risk to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : résumé santé par élève
-- ----------------------------------------------------------------------------
create or replace view public.internat_health_summary as
with recent_checks as (
  select
    student_id,
    max(check_date) as last_check_date,
    avg(temperature) filter (where check_date > current_date - interval '30 days') as avg_temp_30d,
    count(*) filter (where check_date > current_date - interval '30 days') as checks_30d,
    count(*) filter (where temperature >= 38.0 and check_date > current_date - interval '7 days') as fever_episodes_7d,
    count(*) filter (where medication is not null and medication <> '' and check_date > current_date - interval '7 days') as on_medication_7d
  from public.internat_health
  group by student_id
)
select
  s.id as student_id,
  s.establishment_id,
  s.full_name,
  sec.last_check_date,
  sec.avg_temp_30d,
  sec.checks_30d,
  sec.fever_episodes_7d,
  sec.on_medication_7d,
  case
    when sec.fever_episodes_7d >= 1 then true
    else false
  end as has_recent_fever,
  case
    when sec.last_check_date is null or sec.last_check_date < current_date - interval '30 days' then true
    else false
  end as needs_check
from public.students s
left join recent_checks sec on sec.student_id = s.id;

grant select on public.internat_health_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : couverture des repas (servis vs présents)
-- ----------------------------------------------------------------------------
create or replace view public.internat_meal_coverage as
with meals_stats as (
  select
    m.id as meal_id,
    m.establishment_id,
    m.meal_date,
    m.meal_type,
    coalesce(count(ma.id), 0) as attendance_count,
    coalesce(count(*) filter (where ma.present), 0) as present_count,
    coalesce(count(*) filter (where not ma.present), 0) as absent_count
  from public.internat_meals m
  left join public.internat_meal_attendance ma on ma.meal_id = m.id
  where m.meal_date >= current_date - interval '30 days'
  group by m.id, m.establishment_id, m.meal_date, m.meal_type
)
select
  establishment_id,
  meal_date,
  meal_type,
  attendance_count,
  present_count,
  absent_count,
  case when attendance_count = 0 then null
    else round(100.0 * present_count / attendance_count)
  end as presence_rate_pct
from meals_stats
order by meal_date desc, meal_type;

grant select on public.internat_meal_coverage to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : tendances d'occupation 90 jours
-- ----------------------------------------------------------------------------
create or replace view public.internat_occupancy_trends as
with assignment_history as (
  select
    a.bed_id,
    a.start_date,
    a.end_date,
    a.status,
    b.room_id,
    r.block_id,
    blk.establishment_id
  from public.internat_assignments a
  join public.internat_beds b on b.id = a.bed_id
  join public.internat_rooms r on r.id = b.room_id
  join public.internat_blocks blk on blk.id = r.block_id
),
calendar as (
  select day::date from generate_series(current_date - interval '89 days', current_date, interval '1 day') as day
)
select
  c.day,
  e.id as establishment_id,
  coalesce((
    select count(distinct ah.bed_id)
    from assignment_history ah
    where ah.establishment_id = e.id
      and ah.start_date <= c.day
      and (ah.end_date is null or ah.end_date >= c.day)
      and ah.status = 'actif'
  ), 0) as occupied_beds
from calendar c
cross join public.establishments e
order by e.id, c.day;

grant select on public.internat_occupancy_trends to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : suggestion de lit (rotation optimale)
-- ----------------------------------------------------------------------------
-- Choisit le 1er lit libre du bâtiment qui matche le genre de l'élève
-- (si possible), sinon n'importe quel lit libre. Bâtiments genre "mixte"
-- toujours éligibles. Renvoie l'id du lit ou NULL si aucun.
create or replace function public.suggest_bed_assignment(
  p_student_id uuid
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student_gender text;
  v_bed_id uuid;
begin
  -- Pas de genre stocké sur student, fallback sur n'importe quel bâtiment "mixte"
  v_student_gender := 'mixte';

  -- Priorité 1 : bâtiment mixte avec un lit libre
  select bd.id into v_bed_id
  from public.internat_blocks b
  join public.internat_rooms r on r.block_id = b.id
  join public.internat_beds bd on bd.room_id = r.id
  where b.gender = 'mixte'
    and bd.status = 'libre'
    and not exists (
      select 1 from public.internat_assignments a
      where a.bed_id = bd.id and a.status = 'actif'
    )
  order by r.number, bd.bed_number
  limit 1;

  if v_bed_id is not null then return v_bed_id; end if;

  -- Priorité 2 : n'importe quel bâtiment avec un lit libre
  select bd.id into v_bed_id
  from public.internat_blocks b
  join public.internat_rooms r on r.block_id = b.id
  join public.internat_beds bd on bd.room_id = r.id
  where bd.status = 'libre'
    and not exists (
      select 1 from public.internat_assignments a
      where a.bed_id = bd.id and a.status = 'actif'
    )
  order by b.gender = 'mixte' desc, r.number, bd.bed_number
  limit 1;

  return v_bed_id;
end;
$$;

grant execute on function public.suggest_bed_assignment(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : taux de présence moyen d'un élève au roll-call (30j)
-- ----------------------------------------------------------------------------
create or replace function public.compute_student_attendance_rate(
  p_student_id uuid,
  p_days int default 30
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int;
  v_present int;
begin
  select count(*) into v_total
  from public.internat_roll_items ri
  join public.internat_roll_calls rc on rc.id = ri.roll_call_id
  where ri.student_id = p_student_id
    and rc.roll_call_date > current_date - (p_days || ' days')::interval;

  if v_total = 0 then return null; end if;

  select count(*) into v_present
  from public.internat_roll_items ri
  join public.internat_roll_calls rc on rc.id = ri.roll_call_id
  where ri.student_id = p_student_id
    and ri.present = true
    and rc.roll_call_date > current_date - (p_days || ' days')::interval;

  return round(100.0 * v_present / v_total, 1);
end;
$$;

grant execute on function public.compute_student_attendance_rate(uuid, int) to authenticated, service_role;