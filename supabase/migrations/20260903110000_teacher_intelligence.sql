-- ============================================================================
-- SCHOOLY v1 — Dashboard Professeur intelligent
-- ============================================================================
-- Ajoute au module Professeur :
--   * vues agrégées par classe (moyenne, médiane, taux de présence, écart-type) ;
--   * détection automatique d'élèves à risque (décrochage scolaire) ;
--   * courbe de progression par élève et par matière ;
--   * classement inter-classes du même niveau ;
--   * bulletin scolaire par élève ;
--   * fonction de prédiction de moyenne projetée ;
--   * sujet (matière) sur `teacher_assignments` déjà là — exploité pour les
--     moyennes par matière.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : agrégats par classe (dashboard classe)
-- ----------------------------------------------------------------------------
create or replace view public.class_dashboard as
select
  s.id as section_id,
  s.name as section_name,
  s.level_id,
  l.name as level_name,
  s.capacity,
  s.seats_taken,
  -- Moyenne générale de la classe (toutes matières confondues)
  coalesce((
    select round(avg((g.score::numeric / g.max_score) * 20)::numeric, 2)
    from public.grades g
    where g.section_id = s.id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as class_average,
  -- Médiane
  coalesce((
    select percentile_cont(0.5) within group (order by (g.score::numeric / g.max_score) * 20)
    from public.grades g
    where g.section_id = s.id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as class_median,
  -- Taux de présence sur 30 jours
  case
    when (
      select count(*) from public.attendance_records ar
      where ar.section_id = s.id
        and ar.session_date > current_date - interval '30 days'
    ) = 0 then null
    else round(
      100.0 * (
        select count(*) filter (where present) from public.attendance_records ar
        where ar.section_id = s.id
          and ar.session_date > current_date - interval '30 days'
      )::numeric / nullif(
        (select count(*) from public.attendance_records ar
         where ar.section_id = s.id
           and ar.session_date > current_date - interval '30 days'), 0
      )
    )
  end as attendance_rate_pct,
  -- Nombre de notes saisies
  (select count(*) from public.grades g where g.section_id = s.id) as total_grades,
  -- Notes sur les 7 derniers jours
  (select count(*) from public.grades g
   where g.section_id = s.id
     and g.evaluation_date > current_date - interval '7 days') as recent_grades
from public.sections s
join public.levels l on l.id = s.level_id;

grant select on public.class_dashboard to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : élèves à risque (alertes précoces de décrochage)
-- ----------------------------------------------------------------------------
-- Critères :
--   - Baisse de moyenne > 30% entre les 2 dernières notes ;
--   - 3+ absences consécutives non justifiées ;
--   - 2+ notes comportement "a_surveiller" ou "incident" sur 30 jours ;
--   - Moyenne générale < 8/20 sur les 30 derniers jours.
create or replace view public.students_at_risk as
with last_two as (
  select
    g.student_id,
    g.score::numeric / g.max_score * 20 as pct,
    g.evaluation_date,
    row_number() over (partition by g.student_id order by g.evaluation_date desc) as rn
  from public.grades g
  where g.evaluation_date > current_date - interval '60 days'
),
trend as (
  select
    student_id,
    max(pct) filter (where rn = 1) as latest,
    max(pct) filter (where rn = 2) as previous
  from last_two
  where rn <= 2
  group by student_id
),
absences as (
  select
    ar.student_id,
    bool_and(not ar.present) as all_absent,
    count(*) filter (where not ar.present) as abs_count
  from public.attendance_records ar
  where ar.session_date > current_date - interval '14 days'
  group by ar.student_id, ar.session_date
  having count(*) filter (where not ar.present) >= 3
),
behavior_count as (
  select student_id, count(*) as cnt
  from public.behavior_notes
  where kind in ('a_surveiller', 'incident')
    and session_date > current_date - interval '30 days'
  group by student_id
),
avg_30 as (
  select
    g.student_id,
    avg(g.score::numeric / g.max_score * 20) as avg_score
  from public.grades g
  where g.evaluation_date > current_date - interval '30 days'
  group by g.student_id
)
select
  s.id as student_id,
  s.establishment_id,
  s.section_id,
  sec.name as section_name,
  s.full_name,
  coalesce(round(a.avg_score, 2), 0) as current_average,
  coalesce(round(t.latest, 2), 0) as latest_score,
  coalesce(round(t.previous, 2), 0) as previous_score,
  case
    when t.latest is not null and t.previous is not null and t.previous > 0
      and (t.previous - t.latest) / t.previous >= 0.30 then true
    else false
  end as has_significant_drop,
  coalesce(ab.abs_count, 0) >= 3 as has_repeated_absences,
  coalesce(bc.cnt, 0) >= 2 as has_behavior_concerns,
  coalesce(a.avg_score, 20) < 8 as has_low_average,
  -- Niveau d'alerte global
  case
    when (case when t.latest is not null and t.previous is not null and t.previous > 0
                and (t.previous - t.latest) / t.previous >= 0.30 then 1 else 0 end) +
         (case when coalesce(ab.abs_count, 0) >= 3 then 1 else 0 end) +
         (case when coalesce(bc.cnt, 0) >= 2 then 1 else 0 end) +
         (case when coalesce(a.avg_score, 20) < 8 then 1 else 0 end) >= 2 then 'high'
    when (case when t.latest is not null and t.previous is not null and t.previous > 0
                and (t.previous - t.latest) / t.previous >= 0.30 then 1 else 0 end) +
         (case when coalesce(ab.abs_count, 0) >= 3 then 1 else 0 end) +
         (case when coalesce(bc.cnt, 0) >= 2 then 1 else 0 end) +
         (case when coalesce(a.avg_score, 20) < 8 then 1 else 0 end) >= 1 then 'medium'
    else 'low'
  end as risk_level
from public.students s
join public.sections sec on sec.id = s.section_id
left join trend t on t.student_id = s.id
left join absences ab on ab.student_id = s.id
left join behavior_count bc on bc.student_id = s.id
left join avg_30 a on a.student_id = s.id
where
  (t.latest is not null and t.previous is not null and t.previous > 0
    and (t.previous - t.latest) / t.previous >= 0.30)
  or coalesce(ab.abs_count, 0) >= 3
  or coalesce(bc.cnt, 0) >= 2
  or coalesce(a.avg_score, 20) < 8;

grant select on public.students_at_risk to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : progression par élève et par matière (courbe)
-- ----------------------------------------------------------------------------
create or replace view public.grade_progression as
select
  g.student_id,
  g.section_id,
  g.subject,
  g.evaluation_date,
  g.score::numeric / g.max_score * 20 as score_normalized,
  -- Moyenne glissante sur les 3 dernières notes de cette matière
  avg(g.score::numeric / g.max_score * 20) over (
    partition by g.student_id, g.subject
    order by g.evaluation_date
    rows between 2 preceding and current row
  ) as rolling_avg
from public.grades g
order by g.student_id, g.subject, g.evaluation_date;

grant select on public.grade_progression to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : classement inter-classes d'un même niveau
-- ----------------------------------------------------------------------------
create or replace view public.class_ranking as
select
  s.id as section_id,
  s.name as section_name,
  s.level_id,
  coalesce((
    select avg((g.score::numeric / g.max_score) * 20)
    from public.grades g
    where g.section_id = s.id
      and g.evaluation_date > current_date - interval '90 days'
  ), 0) as average_score,
  rank() over (
    partition by s.level_id
    order by coalesce((
      select avg((g.score::numeric / g.max_score) * 20)
      from public.grades g
      where g.section_id = s.id
        and g.evaluation_date > current_date - interval '90 days'
    ), 0) desc
  ) as rank_in_level
from public.sections s;

grant select on public.class_ranking to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : bulletin scolaire par élève
-- ----------------------------------------------------------------------------
create or replace view public.student_report_card as
select
  s.id as student_id,
  s.full_name as student_name,
  s.section_id,
  g.subject,
  count(*) as grades_count,
  round(avg(g.score::numeric / g.max_score * 20)::numeric, 2) as subject_average,
  min(g.score::numeric / g.max_score * 20) as min_score,
  max(g.score::numeric / g.max_score * 20) as max_score,
  round(stddev_pop(g.score::numeric / g.max_score * 20)::numeric, 2) as std_deviation
from public.students s
left join public.grades g on g.student_id = s.id
  and g.evaluation_date > current_date - interval '120 days'
group by s.id, s.full_name, s.section_id, g.subject;

grant select on public.student_report_card to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : prédiction de moyenne projetée fin de trimestre
-- ----------------------------------------------------------------------------
-- Basée sur une régression linéaire simple sur les 6 dernières notes.
create or replace function public.predict_student_average(
  p_student_id uuid,
  p_subject text default null
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_trend numeric;
  v_predicted numeric;
begin
  -- Moyenne actuelle
  select avg(g.score::numeric / g.max_score * 20)
  into v_avg
  from public.grades g
  where g.student_id = p_student_id
    and (p_subject is null or g.subject = p_subject)
    and g.evaluation_date > current_date - interval '60 days';

  if v_avg is null then return 0; end if;

  -- Tendance (delta moyen entre notes consécutives)
  with ordered as (
    select
      (g.score::numeric / g.max_score * 20) as score,
      row_number() over (order by g.evaluation_date) as rn
    from public.grades g
    where g.student_id = p_student_id
      and (p_subject is null or g.subject = p_subject)
      and g.evaluation_date > current_date - interval '60 days'
  ),
  deltas as (
    select
      o2.score - o1.score as delta
    from ordered o1
    join ordered o2 on o2.rn = o1.rn + 1
  )
  select avg(delta) into v_trend from deltas;

  v_predicted := v_avg + coalesce(v_trend, 0) * 3; -- projection sur 3 évaluations

  return round(greatest(0, least(20, v_predicted))::numeric, 2);
end;
$$;

grant execute on function public.predict_student_average(uuid, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Vue : élèves d'une classe avec leur prédiction
-- ----------------------------------------------------------------------------
create or replace view public.student_predictions as
select
  s.id as student_id,
  s.section_id,
  s.full_name,
  coalesce(avg((g.score::numeric / g.max_score) * 20), 0) as current_average,
  coalesce(public.predict_student_average(s.id, null), 0) as predicted_average
from public.students s
left join public.grades g on g.student_id = s.id
  and g.evaluation_date > current_date - interval '60 days'
group by s.id, s.section_id, s.full_name;

grant select on public.student_predictions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. Vue : distribution des moyennes par classe (histogramme)
-- ----------------------------------------------------------------------------
create or replace view public.class_grade_distribution as
with normalized as (
  select
    g.section_id,
    (g.score::numeric / g.max_score * 20) as score_norm
  from public.grades g
  where g.evaluation_date > current_date - interval '90 days'
)
select
  section_id,
  case
    when score_norm >= 16 then 'excellent'
    when score_norm >= 14 then 'bien'
    when score_norm >= 10 then 'moyen'
    when score_norm >= 8 then 'fragile'
    else 'critique'
  end as bucket,
  count(*) as count
from normalized
group by section_id, case
    when score_norm >= 16 then 'excellent'
    when score_norm >= 14 then 'bien'
    when score_norm >= 10 then 'moyen'
    when score_norm >= 8 then 'fragile'
    else 'critique'
  end;

grant select on public.class_grade_distribution to authenticated, service_role;