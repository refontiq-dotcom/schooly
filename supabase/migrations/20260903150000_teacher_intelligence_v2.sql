-- ============================================================================
-- SCHOOLY v1 — Professeurs v2 (vues centrées sur l'enseignant connecté)
-- ============================================================================
-- Ajoute au module Professeur :
--   * vue "mes classes" (synthèse des classes du prof) ;
--   * vue "mes élèves à risque" (filtrée par teacher_assignments) ;
--   * vue "ma charge" (nb classes, élèves, notes saisies cette semaine) ;
--   * vue "mon homeroom" (élèves des classes dont prof est principal) ;
--   * vue "comparatif de mes classes" (moyennes côte-à-côte) ;
--   * vue "retards de saisie" (sessions d'il y a 5+ jours sans note).
--
-- IMPORTANT : idempotent. Pas de table class_sessions / homework
-- → fallback sur dates d'évaluation sans note correspondante.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : mes classes (synthèse par classe, filtrée par teacher_assignments)
-- ----------------------------------------------------------------------------
create or replace view public.teacher_my_classes as
select
  ta.teacher_id,
  p.establishment_id,
  ta.section_id,
  sec.name as section_name,
  l.name as level_name,
  sec.capacity,
  sec.seats_taken,
  ta.subject,
  coalesce((
    select round(avg((g.score::numeric / g.max_score) * 20)::numeric, 2)
    from public.grades g
    where g.section_id = ta.section_id
      and g.subject = ta.subject
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as subject_average,
  coalesce((
    select count(*) from public.grades g
    where g.section_id = ta.section_id
      and g.subject = ta.subject
  ), 0) as total_grades_subject,
  coalesce((
    select count(*) from public.grades g
    where g.section_id = ta.section_id
      and g.subject = ta.subject
      and g.evaluation_date > current_date - interval '7 days'
  ), 0) as grades_last_7d,
  sec.homeroom_teacher_id = ta.teacher_id as is_homeroom
from public.teacher_assignments ta
join public.sections sec on sec.id = ta.section_id
join public.levels l on l.id = sec.level_id
join public.profiles p on p.id = ta.teacher_id;

grant select on public.teacher_my_classes to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : mes élèves à risque (filtrés par mes classes)
-- ----------------------------------------------------------------------------
create or replace view public.teacher_my_at_risk_students as
with my_sections as (
  select distinct ta.teacher_id, ta.section_id
  from public.teacher_assignments ta
)
select
  ms.teacher_id,
  sar.student_id,
  sar.full_name,
  sar.section_id,
  sar.section_name,
  sar.current_average,
  sar.latest_score as latest_2_avg,
  sar.previous_score as previous_2_avg,
  null::numeric as attendance_pct_30d,
  sar.risk_level as alert_level,
  null::text[] as reasons
from my_sections ms
join public.students_at_risk sar on sar.section_id = ms.section_id;

grant select on public.teacher_my_at_risk_students to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : ma charge (workload du prof)
-- ----------------------------------------------------------------------------
create or replace view public.teacher_workload_summary as
select
  p.id as teacher_id,
  p.establishment_id,
  p.full_name as teacher_name,
  count(distinct ta.section_id) as classes_count,
  count(distinct ta.subject) as subjects_count,
  count(distinct ta.section_id || '|' || ta.subject) as class_subject_pairs,
  coalesce(sum(sec.seats_taken) filter (where sec.homeroom_teacher_id = p.id), 0) as homeroom_students,
  coalesce((
    select count(*) from public.grades g
    where g.recorded_by = p.id
      and g.evaluation_date > current_date - interval '7 days'
  ), 0) as grades_recorded_7d,
  coalesce((
    select count(*) from public.attendance_records ar
    where ar.recorded_by = p.id
      and ar.session_date > current_date - interval '7 days'
  ), 0) as attendance_records_7d,
  case
    when count(distinct ta.section_id) >= 6 then 'high'
    when count(distinct ta.section_id) >= 3 then 'normal'
    when count(distinct ta.section_id) >= 1 then 'low'
    else 'none'
  end as workload_level
from public.profiles p
left join public.teacher_assignments ta on ta.teacher_id = p.id
left join public.sections sec on sec.id = ta.section_id
where p.role = 'professeur'
group by p.id, p.establishment_id, p.full_name;

grant select on public.teacher_workload_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : mon homeroom (classes dont je suis prof principal)
-- ----------------------------------------------------------------------------
create or replace view public.teacher_homeroom_overview as
select
  sec.homeroom_teacher_id as teacher_id,
  p.establishment_id,
  sec.id as section_id,
  sec.name as section_name,
  l.name as level_name,
  sec.capacity,
  sec.seats_taken,
  count(s.id) as students_count,
  coalesce(round(avg((g.score::numeric / g.max_score) * 20)::numeric, 2), 0) as class_average,
  count(*) filter (
    where sar.risk_level is not null
  ) as at_risk_count
from public.sections sec
join public.profiles p on p.id = sec.homeroom_teacher_id
join public.levels l on l.id = sec.level_id
left join public.students s on s.section_id = sec.id
left join public.grades g on g.section_id = sec.id
  and g.evaluation_date > current_date - interval '90 days'
left join public.students_at_risk sar on sar.student_id = s.id
group by sec.homeroom_teacher_id, p.establishment_id, sec.id, sec.name, l.name, sec.capacity, sec.seats_taken;

grant select on public.teacher_homeroom_overview to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : comparatif de mes classes (côte-à-côte)
-- ----------------------------------------------------------------------------
create or replace view public.teacher_classes_comparison as
select
  tmc.teacher_id,
  tmc.subject,
  tmc.section_id,
  tmc.section_name,
  tmc.level_name,
  tmc.capacity,
  tmc.seats_taken,
  tmc.subject_average,
  coalesce((
    select round(avg((g.score::numeric / g.max_score) * 20)::numeric, 2)
    from public.grades g
    where g.section_id = tmc.section_id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as global_section_average,
  coalesce((
    select round(stddev_pop((g.score::numeric / g.max_score) * 20)::numeric, 2)
    from public.grades g
    where g.section_id = tmc.section_id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as std_deviation,
  tmc.subject_average - coalesce((
    select avg((g.score::numeric / g.max_score) * 20)
    from public.grades g
    where g.section_id = tmc.section_id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as subject_vs_global_diff
from public.teacher_my_classes tmc;

grant select on public.teacher_classes_comparison to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Vue : retards de saisie (sessions d'il y a 3-10 jours sans note)
-- ----------------------------------------------------------------------------
-- Détecte les sessions de présence récentes (3-10 jours) sans note enregistrée
-- dans la même matière → indique un devoir noté non rendu ou non saisi.
create or replace view public.teacher_pending_grades as
with my_classes as (
  select ta.teacher_id, ta.section_id, ta.subject
  from public.teacher_assignments ta
),
session_days as (
  select distinct
    ms.teacher_id,
    ms.section_id,
    ms.subject,
    ar.session_date
  from my_classes ms
  join public.attendance_records ar on ar.section_id = ms.section_id
  where ar.session_date between current_date - interval '10 days' and current_date - interval '3 days'
),
graded_days as (
  select distinct
    ms.teacher_id,
    ms.section_id,
    ms.subject,
    g.evaluation_date as session_date
  from my_classes ms
  join public.grades g on g.section_id = ms.section_id and g.subject = ms.subject
  where g.evaluation_date between current_date - interval '10 days' and current_date - interval '3 days'
)
select
  sd.teacher_id,
  sd.section_id,
  sec.name as section_name,
  sd.subject,
  sd.session_date,
  current_date - sd.session_date as days_ago
from session_days sd
left join graded_days gd on gd.teacher_id = sd.teacher_id
  and gd.section_id = sd.section_id
  and gd.subject = sd.subject
  and gd.session_date = sd.session_date
join public.sections sec on sec.id = sd.section_id
where gd.session_date is null
order by sd.session_date;

grant select on public.teacher_pending_grades to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : moyenne de mes classes (toutes matières confondues)
-- ----------------------------------------------------------------------------
create or replace function public.compute_teacher_global_average(
  p_teacher_id uuid,
  p_days int default 90
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_avg numeric;
begin
  select round(avg((g.score::numeric / g.max_score) * 20)::numeric, 2)
    into v_avg
  from public.grades g
  join public.teacher_assignments ta
    on ta.section_id = g.section_id and ta.subject = g.subject
  where ta.teacher_id = p_teacher_id
    and g.evaluation_date > current_date - (p_days || ' days')::interval;

  return coalesce(v_avg, 0);
end;
$$;

grant execute on function public.compute_teacher_global_average(uuid, int) to authenticated, service_role;
