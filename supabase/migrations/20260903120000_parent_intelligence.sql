-- ============================================================================
-- SCHOOLY v1 — Dashboard Parent intelligent
-- ============================================================================
-- Ajoute au module Parent :
--   * une vue d'ensemble 360° par enfant (moyennes, présence, paiements,
--     documents, comportement) ;
--   * le positionnement dans la classe (rang parmi les camarades) ;
--   * la détection de recommandations contextualisées ;
--   * la courbe de progression pour les parents ;
--   * un résumé WhatsApp prêt à partager.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : synthèse complète par enfant (dashboard parent)
-- ----------------------------------------------------------------------------
create or replace view public.parent_dashboard_summary as
with avg_all as (
  select
    g.student_id,
    avg(g.score::numeric / g.max_score * 20) as avg_score,
    count(*) as grades_count,
    max(g.evaluation_date) as last_grade_date
  from public.grades g
  where g.evaluation_date > current_date - interval '90 days'
  group by g.student_id
),
trend_2 as (
  select student_id,
    avg((score::numeric / max_score) * 20) filter (where rn <= 2) as latest_2_avg,
    avg((score::numeric / max_score) * 20) filter (where rn between 3 and 4) as previous_2_avg
  from (
    select g.student_id, g.score, g.max_score,
      row_number() over (partition by g.student_id order by g.evaluation_date desc) as rn
    from public.grades g
    where g.evaluation_date > current_date - interval '60 days'
  ) t
  where rn <= 4
  group by student_id
),
att_stats as (
  select
    ar.student_id,
    count(*) filter (where ar.present) as present_count,
    count(*) as total_count,
    case when count(*) = 0 then null
      else round(100.0 * count(*) filter (where ar.present) / count(*))
    end as attendance_pct
  from public.attendance_records ar
  where ar.session_date > current_date - interval '30 days'
  group by ar.student_id
),
abs_recent as (
  select ar.student_id, count(*) as abs_count
  from public.attendance_records ar
  where ar.session_date > current_date - interval '14 days'
    and not ar.present
  group by ar.student_id
),
fee_stats as (
  select
    sf.student_id,
    sum(sf.amount - sf.amount_paid) as remaining,
    count(*) filter (where sf.status = 'overdue') as overdue_count
  from public.student_fees sf
  group by sf.student_id
),
doc_stats as (
  select
    sd.student_id,
    count(*) filter (where sd.required and sd.status = 'missing') as missing_required
  from public.student_documents sd
  group by sd.student_id
),
behavior_stats as (
  select bn.student_id, count(*) as cnt
  from public.behavior_notes bn
  where bn.kind in ('a_surveiller', 'incident')
    and bn.session_date > current_date - interval '30 days'
  group by bn.student_id
)
select
  s.id as student_id,
  s.parent_id,
  s.establishment_id,
  sec.name as section_name,
  l.name as level_name,
  s.full_name,
  coalesce(round(aa.avg_score, 2), 0) as current_average,
  aa.grades_count as grades_count_90d,
  aa.last_grade_date,
  coalesce(round(t2.latest_2_avg, 2), 0) as latest_2_avg,
  coalesce(round(t2.previous_2_avg, 2), 0) as previous_2_avg,
  case
    when t2.latest_2_avg is not null and t2.previous_2_avg is not null and t2.previous_2_avg > 0
      and (t2.previous_2_avg - t2.latest_2_avg) / t2.previous_2_avg >= 0.30 then true
    else false
  end as has_recent_drop,
  att.attendance_pct as attendance_pct_30d,
  coalesce(ar.abs_count, 0) as recent_absences,
  coalesce(fs.remaining, 0) as fees_remaining,
  coalesce(fs.overdue_count, 0) as fees_overdue_count,
  coalesce(ds.missing_required, 0) as docs_missing_count,
  coalesce(bs.cnt, 0) as behavior_concerns_count,
  -- Score de satisfaction global (0..100, plus c'est haut plus c'est OK)
  least(100, greatest(0,
    coalesce(att.attendance_pct, 70)                  -- 30% : assiduité
    + least(40, greatest(0, aa.avg_score * 2))         -- 40% : moyenne
    + (case when coalesce(fs.overdue_count, 0) = 0 then 20 else 0 end) -- 20% : pas de retard
    + (case when coalesce(ds.missing_required, 0) = 0 then 10 else 0 end) -- 10% : docs OK
    - (coalesce(bs.cnt, 0) * 5)                       -- pénalité comportement
  ) / 2) as parent_satisfaction_score
from public.students s
join public.sections sec on sec.id = s.section_id
join public.levels l on l.id = sec.level_id
left join avg_all aa on aa.student_id = s.id
left join trend_2 t2 on t2.student_id = s.id
left join att_stats att on att.student_id = s.id
left join abs_recent ar on ar.student_id = s.id
left join fee_stats fs on fs.student_id = s.id
left join doc_stats ds on ds.student_id = s.id
left join behavior_stats bs on bs.student_id = s.id;

grant select on public.parent_dashboard_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : positionnement de l'élève dans sa classe
-- ----------------------------------------------------------------------------
create or replace view public.student_class_ranking as
with normalized as (
  select
    g.student_id,
    g.section_id,
    (g.score::numeric / g.max_score) * 20 as score_norm
  from public.grades g
  where g.evaluation_date > current_date - interval '90 days'
),
averages as (
  select student_id, section_id, avg(score_norm) as avg_score
  from normalized
  group by student_id, section_id
),
ranked as (
  select
    student_id,
    section_id,
    avg_score,
    rank() over (partition by section_id order by avg_score desc) as rank_in_section,
    count(*) over (partition by section_id) as section_size
  from averages
)
select
  s.id as student_id,
  s.full_name as student_name,
  r.section_id,
  sec.name as section_name,
  round(r.avg_score, 2) as class_average,
  r.rank_in_section,
  r.section_size,
  -- Percentile (0..100)
  round(100.0 * (r.section_size - r.rank_in_section) / nullif(r.section_size, 0)) as percentile
from public.students s
join ranked r on r.student_id = s.id
join public.sections sec on sec.id = r.section_id;

grant select on public.student_class_ranking to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : progression pour graphique parent
-- ----------------------------------------------------------------------------
create or replace view public.parent_progression as
select
  g.student_id,
  g.subject,
  g.evaluation_date,
  (g.score::numeric / g.max_score) * 20 as score_normalized,
  avg((g.score::numeric / g.max_score) * 20) over (
    partition by g.student_id, g.subject
    order by g.evaluation_date
    rows between 2 preceding and current row
  ) as rolling_avg
from public.grades g
order by g.student_id, g.subject, g.evaluation_date;

grant select on public.parent_progression to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : alertes/recos contextualisées pour le parent
-- ----------------------------------------------------------------------------
create or replace view public.parent_alerts as
select
  pds.student_id,
  pds.full_name,
  pds.parent_id,
  -- Liste des alertes (chacune avec son type et son message)
  case when pds.has_recent_drop then jsonb_build_array(
    jsonb_build_object(
      'type', 'grade_drop',
      'severity', 'high',
      'title', 'Baisse de moyenne',
      'message', 'La moyenne des 2 dernières notes a baissé de plus de 30% par rapport aux 2 précédentes.'
    )
  ) else '[]'::jsonb end ||
  case when pds.recent_absences >= 3 then jsonb_build_array(
    jsonb_build_object(
      'type', 'absences',
      'severity', 'high',
      'title', 'Absences répétées',
      'message', pds.recent_absences || ' absences non justifiées sur les 14 derniers jours.'
    )
  ) else '[]'::jsonb end ||
  case when pds.attendance_pct_30d is not null and pds.attendance_pct_30d < 75 then jsonb_build_array(
    jsonb_build_object(
      'type', 'low_attendance',
      'severity', 'medium',
      'title', 'Assiduité faible',
      'message', 'Taux de présence de ' || pds.attendance_pct_30d || '% sur 30 jours.'
    )
  ) else '[]'::jsonb end ||
  case when pds.fees_overdue_count > 0 then jsonb_build_array(
    jsonb_build_object(
      'type', 'fees_overdue',
      'severity', 'high',
      'title', 'Frais en retard',
      'message', pds.fees_overdue_count || ' échéance(s) en retard, total ' || round(pds.fees_remaining) || ' FCFA.'
    )
  ) else '[]'::jsonb end ||
  case when pds.docs_missing_count > 0 then jsonb_build_array(
    jsonb_build_object(
      'type', 'docs_missing',
      'severity', 'medium',
      'title', 'Documents manquants',
      'message', pds.docs_missing_count || ' document(s) obligatoire(s) non déposés.'
    )
  ) else '[]'::jsonb end ||
  case when pds.behavior_concerns_count >= 2 then jsonb_build_array(
    jsonb_build_object(
      'type', 'behavior',
      'severity', 'medium',
      'title', 'Suivi comportement',
      'message', pds.behavior_concerns_count || ' signalements "à surveiller/incident" sur 30 jours.'
    )
  ) else '[]'::jsonb end ||
  case when pds.current_average > 0 and pds.current_average >= 16 then jsonb_build_array(
    jsonb_build_object(
      'type', 'excellence',
      'severity', 'positive',
      'title', 'Excellent travail !',
      'message', 'Moyenne de ' || pds.current_average || '/20. Continuez ainsi.'
    )
  ) else '[]'::jsonb end
  as alerts
from public.parent_dashboard_summary pds
where pds.has_recent_drop
  or pds.recent_absences >= 3
  or (pds.attendance_pct_30d is not null and pds.attendance_pct_30d < 75)
  or pds.fees_overdue_count > 0
  or pds.docs_missing_count > 0
  or pds.behavior_concerns_count >= 2
  or pds.current_average >= 16;

grant select on public.parent_alerts to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : génère un résumé WhatsApp prêt à partager
-- ----------------------------------------------------------------------------
create or replace function public.generate_parent_whatsapp_summary(p_student_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary public.parent_dashboard_summary;
  v_rank public.student_class_ranking;
  v_lines text[] := array[]::text[];
begin
  select * into v_summary from public.parent_dashboard_summary where student_id = p_student_id;
  if v_summary is null then return 'Élève introuvable'; end if;

  v_lines := array_append(v_lines, '📚 *' || v_summary.full_name || '* — ' || coalesce(v_summary.level_name, '') || ' / ' || coalesce(v_summary.section_name, ''));

  if v_summary.current_average > 0 then
    v_lines := array_append(v_lines, '🎯 Moyenne : *' || round(v_summary.current_average, 2) || '/20*');
  end if;

  if v_summary.attendance_pct_30d is not null then
    v_lines := array_append(v_lines, '📅 Assiduité 30j : *' || v_summary.attendance_pct_30d || '%*');
  end if;

  select * into v_rank from public.student_class_ranking where student_id = p_student_id;
  if v_rank is not null and v_rank.section_size > 0 then
    v_lines := array_append(v_lines, '🏆 Rang : *' || v_rank.rank_in_section || 'e / ' || v_rank.section_size || '*');
  end if;

  if v_summary.fees_remaining > 0 then
    v_lines := array_append(v_lines, '💰 Restant : *' || round(v_summary.fees_remaining) || ' FCFA*' ||
      case when v_summary.fees_overdue_count > 0 then ' (⚠️ ' || v_summary.fees_overdue_count || ' en retard)' else '' end);
  end if;

  if v_summary.docs_missing_count > 0 then
    v_lines := array_append(v_lines, '📄 Documents manquants : *' || v_summary.docs_missing_count || '*');
  end if;

  return array_to_string(v_lines, E'\n');
end;
$$;

grant execute on function public.generate_parent_whatsapp_summary(uuid) to authenticated;