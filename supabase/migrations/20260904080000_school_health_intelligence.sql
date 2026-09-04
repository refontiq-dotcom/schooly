-- ============================================================================
-- SCHOOLY v1 — Vue d'ensemble santé école (méta-vue consolidée par étab.)
-- ============================================================================
-- Agrège 50+ KPIs en 1 ligne par établissement, croisant :
--   Auth, Équipe, Réservations, Classes, Élèves, Paiements, Documents,
--   Notes, Comportement, Messages, Internat, Secrétariat, Onboarding.
--
-- IMPORTANT : idempotent. Agrège en lecture seule (vues + tables existantes).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : état de l'école (1 ligne = 1 établissement, 50+ indicateurs)
-- ----------------------------------------------------------------------------
create or replace view public.school_health_overview as
with
-- ── Auth / sécurité ─────────────────────────────────────────────────────
auth_metrics as (
  select
    p.establishment_id as eid,
    count(*) filter (where u.id is not null) as auth_users_total,
    count(*) filter (
      where u.id is not null
        and u.last_sign_in_at is not null
        and u.last_sign_in_at > now() - interval '24 hours'
    ) as auth_active_sessions_24h,
    count(*) filter (where u.id is null) as auth_orphan_profiles,
    count(*) filter (
      where u.id is not null
        and u.banned_until is not null
        and u.banned_until > now()
    ) as auth_banned_users
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.establishment_id is not null
  group by p.establishment_id
),
dup_accounts as (
  select
    establishment_id as eid,
    count(*) as auth_duplicate_account_groups
  from (
    select establishment_id, lower(trim(email)) as norm
    from public.profiles
    where establishment_id is not null
      and email is not null and email <> ''
    group by establishment_id, lower(trim(email))
    having count(*) > 1
  ) d
  group by eid
),
-- ── Équipe ──────────────────────────────────────────────────────────────
team_metrics as (
  select
    establishment_id as eid,
    count(*) filter (where role in ('admin','professeur','secretariat','censeur')) as staff_total,
    count(*) filter (where role = 'admin') as staff_admin_count,
    count(*) filter (where role = 'professeur') as staff_teacher_count,
    count(*) filter (where role = 'secretariat') as staff_secretariat_count,
    count(*) filter (where role = 'censeur') as staff_censeur_count,
    count(*) filter (where role = 'parent') as parent_count
  from public.profiles
  where establishment_id is not null
  group by establishment_id
),
-- ── Réservations funnel ─────────────────────────────────────────────────
res_metrics as (
  select
    establishment_id as eid,
    count(*) filter (where status = 'pending_payment') as res_pending_payment_count,
    count(*) filter (where status = 'reserved') as res_reserved_count,
    count(*) filter (where status = 'confirmed') as res_confirmed_count,
    count(*) filter (where status = 'expired') as res_expired_count,
    count(*) filter (where status = 'cancelled') as res_cancelled_count,
    count(*) filter (where status = 'waitlisted') as res_waitlisted_count,
    count(*) filter (where status = 'rejected_fraud') as res_rejected_fraud_count,
    count(*) as res_total_count,
    round(avg(parent_trust_score) filter (where parent_trust_score is not null), 1) as res_avg_parent_trust_score,
    count(*) filter (where parent_trust_score is not null and parent_trust_score < 40) as res_high_fraud_risk_count,
    coalesce(max(waitlist_position), 0) as res_waitlist_max_position
  from public.reservations
  group by establishment_id
),
-- ── Classes / sections ──────────────────────────────────────────────────
class_metrics as (
  select
    l.establishment_id as eid,
    count(s.id) as total_sections,
    coalesce(sum(s.capacity), 0) as total_capacity,
    coalesce(sum(s.seats_taken), 0) as total_seats_taken,
    case when coalesce(sum(s.capacity), 0) = 0 then 0
      else round(100.0 * sum(s.seats_taken) / sum(s.capacity))
    end as fill_rate_pct,
    coalesce(sum(s.capacity - s.seats_taken), 0) as total_seats_available,
    count(*) filter (where s.capacity > 0 and s.seats_taken >= s.capacity) as full_sections_count,
    count(*) filter (where s.capacity > 0 and s.seats_taken < s.capacity * 0.5) as low_fill_sections_count,
    count(distinct l.id) as total_levels
  from public.levels l
  left join public.sections s on s.level_id = l.id
  group by l.establishment_id
),
-- ── Élèves ──────────────────────────────────────────────────────────────
student_metrics as (
  select
    establishment_id as eid,
    count(*) as students_total,
    count(*) filter (where created_at > current_date - interval '30 days') as students_new_30d,
    count(*) filter (where created_at > current_date - interval '7 days') as students_new_7d,
    coalesce(round(avg((current_date - birthdate) / 365.25)::numeric, 1), 0) as students_avg_age
  from public.students
  group by establishment_id
),
student_by_level as (
  select
    sl.establishment_id as eid,
    jsonb_object_agg(sl.level_name, sl.cnt) as students_by_level
  from (
    select
      s.establishment_id,
      l.name as level_name,
      count(*) as cnt
    from public.students s
    join public.sections sec on sec.id = s.section_id
    join public.levels l on l.id = sec.level_id
    group by s.establishment_id, l.name
  ) sl
  group by sl.establishment_id
),
-- ── Paiements ───────────────────────────────────────────────────────────
pay_metrics as (
  select
    e.id as eid,
    coalesce(ps.total_collected, 0) as pay_total_collected,
    coalesce(ps.total_pending, 0) as pay_total_pending,
    coalesce(ps.total_remaining, 0) as pay_total_remaining,
    coalesce(ps.recovery_rate_pct, 0) as pay_recovery_rate_pct,
    coalesce(ps.confirmed_count, 0)::int as pay_confirmed_count,
    coalesce(ps.pending_count, 0)::int as pay_pending_count,
    coalesce(ps.failed_count, 0)::int as pay_failed_count,
    coalesce(fee_stats.overdue_count, 0) as fees_overdue_count,
    coalesce(fee_stats.partial_count, 0) as fees_partial_count,
    coalesce(fee_stats.high_risk_count, 0) as pay_high_risk_count
  from public.establishments e
  left join public.payment_overview ps on ps.establishment_id = e.id
  left join (
    select
      establishment_id,
      count(*) filter (where status = 'overdue') as overdue_count,
      count(*) filter (where status = 'partial') as partial_count,
      count(*) filter (where payment_risk_score is not null and payment_risk_score >= 60) as high_risk_count
    from public.student_fees
    group by establishment_id
  ) fee_stats on fee_stats.establishment_id = e.id
),
-- ── Documents ───────────────────────────────────────────────────────────
doc_metrics as (
  select
    establishment_id as eid,
    coalesce(round(avg(completeness_pct), 1), 100) as docs_avg_completeness_pct,
    coalesce(sum(required_total), 0) as docs_total_required,
    coalesce(sum(required_validated), 0) as docs_total_validated,
    coalesce(sum(required_missing), 0) as docs_total_missing,
    count(*) filter (where status in ('incomplete','pending_validation')) as docs_students_incomplete
  from public.student_documents_completeness
  group by establishment_id
),
-- ── Notes / évaluation ─────────────────────────────────────────────────
grade_metrics as (
  select
    s.establishment_id as eid,
    count(*) as grades_total_count,
    round(avg((g.score::numeric / g.max_score) * 20), 2) as grades_overall_average,
    round(avg((g.score::numeric / g.max_score) * 20) filter (
      where g.evaluation_date > current_date - interval '30 days'
    ), 2) as grades_avg_30d,
    count(*) filter (where g.evaluation_date > current_date - interval '7 days') as grades_recorded_7d
  from public.grades g
  join public.students s on s.id = g.student_id
  group by s.establishment_id
),
-- ── Élèves à risque (détectés par teacher_intelligence) ─────────────────
at_risk_aggregated as (
  select
    establishment_id as eid,
    count(*) as students_at_risk_count,
    count(*) filter (where risk_level = 'high') as students_at_risk_high,
    count(*) filter (where risk_level = 'medium') as students_at_risk_medium
  from public.students_at_risk
  group by establishment_id
),
-- ── Comportement ────────────────────────────────────────────────────────
behavior_metrics as (
  select
    s.establishment_id as eid,
    count(*) as beh_total_notes_30d,
    count(*) filter (where bn.kind = 'incident') as beh_incidents_30d,
    count(*) filter (where bn.kind = 'a_surveiller') as beh_a_surveiller_30d
  from public.behavior_notes bn
  join public.students s on s.id = bn.student_id
  where bn.session_date > current_date - interval '30 days'
  group by s.establishment_id
),
-- ── Messages ────────────────────────────────────────────────────────────
message_metrics as (
  select
    establishment_id as eid,
    count(*) as msg_total_30d,
    count(*) filter (where read_at is null) as msg_unread_count,
    case when count(*) = 0 then null
      else round(100.0 * count(*) filter (where read_at is not null) / count(*))
    end as msg_read_rate_pct
  from public.messages
  where created_at > current_date - interval '30 days'
  group by establishment_id
),
-- ── Présence classe (30j) ───────────────────────────────────────────────
attendance_metrics as (
  select
    s.establishment_id as eid,
    count(*) filter (where a.session_date > current_date - interval '30 days') as att_total_records_30d,
    count(*) filter (where a.present and a.session_date > current_date - interval '30 days') as att_present_count_30d,
    count(*) filter (where not a.present and a.session_date > current_date - interval '30 days') as att_absent_count_30d,
    case
      when count(*) filter (where a.session_date > current_date - interval '30 days') = 0 then null
      else round(
        100.0 * count(*) filter (where a.present and a.session_date > current_date - interval '30 days')::numeric
        / nullif(count(*) filter (where a.session_date > current_date - interval '30 days'), 0)
      )
    end as att_rate_pct_30d
  from public.attendance_records a
  join public.students s on s.id = a.student_id
  group by s.establishment_id
),
-- ── Internat (optionnel, 0 si pas d'internat) ───────────────────────────
internat_metrics as (
  select
    e.id as eid,
    coalesce(d.total_beds, 0) as int_total_beds,
    coalesce(d.occupied_beds, 0) as int_occupied_beds,
    coalesce(d.free_beds, 0) as int_free_beds,
    d.occupancy_rate_pct as int_occupancy_rate_pct,
    coalesce(d.incidents_7d, 0) as int_incidents_7d,
    coalesce(d.incidents_30d, 0) as int_incidents_30d,
    coalesce(d.grave_open_incidents, 0) as int_grave_open_incidents,
    coalesce(d.visits_today, 0) as int_visits_today
  from public.establishments e
  left join public.internat_dashboard d on d.establishment_id = e.id
),
-- ── Secrétariat ─────────────────────────────────────────────────────────
secretariat_metrics as (
  select
    e.id as eid,
    coalesce(sda.total_pending_actions, 0) as sec_total_pending_actions,
    coalesce(sda.students_with_incomplete_docs, 0) as sec_students_incomplete_docs,
    coalesce(sda.pending_payment_count, 0) as sec_pending_payment_count,
    coalesce(sda.reservations_today, 0) as sec_reservations_today
  from public.establishments e
  left join public.secretariat_daily_actions sda on sda.establishment_id = e.id
),
-- ── Onboarding : parents sans établissement (global) ────────────────────
parents_no_establishment as (
  select count(*) as cnt
  from public.profiles
  where role = 'parent' and establishment_id is null
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  e.city,
  e.school_type,

  -- Auth / sécurité (5)
  coalesce(am.auth_users_total, 0)::int as auth_users_total,
  coalesce(am.auth_active_sessions_24h, 0)::int as auth_active_sessions_24h,
  coalesce(am.auth_orphan_profiles, 0)::int as auth_orphan_profiles,
  coalesce(am.auth_banned_users, 0)::int as auth_banned_users,
  coalesce(da.auth_duplicate_account_groups, 0)::int as auth_duplicate_account_groups,

  -- Équipe (6)
  coalesce(tm.staff_total, 0)::int as staff_total,
  coalesce(tm.staff_admin_count, 0)::int as staff_admin_count,
  coalesce(tm.staff_teacher_count, 0)::int as staff_teacher_count,
  coalesce(tm.staff_secretariat_count, 0)::int as staff_secretariat_count,
  coalesce(tm.staff_censeur_count, 0)::int as staff_censeur_count,
  coalesce(tm.parent_count, 0)::int as parent_count,

  -- Réservations (11)
  coalesce(rm.res_pending_payment_count, 0)::int as res_pending_payment_count,
  coalesce(rm.res_reserved_count, 0)::int as res_reserved_count,
  coalesce(rm.res_confirmed_count, 0)::int as res_confirmed_count,
  coalesce(rm.res_expired_count, 0)::int as res_expired_count,
  coalesce(rm.res_cancelled_count, 0)::int as res_cancelled_count,
  coalesce(rm.res_waitlisted_count, 0)::int as res_waitlisted_count,
  coalesce(rm.res_rejected_fraud_count, 0)::int as res_rejected_fraud_count,
  coalesce(rm.res_total_count, 0)::int as res_total_count,
  coalesce(rm.res_avg_parent_trust_score, 0) as res_avg_parent_trust_score,
  coalesce(rm.res_high_fraud_risk_count, 0)::int as res_high_fraud_risk_count,
  coalesce(rm.res_waitlist_max_position, 0)::int as res_waitlist_max_position,

  -- Classes (8)
  coalesce(cm.total_sections, 0)::int as total_sections,
  coalesce(cm.total_capacity, 0)::int as total_capacity,
  coalesce(cm.total_seats_taken, 0)::int as total_seats_taken,
  coalesce(cm.fill_rate_pct, 0) as fill_rate_pct,
  coalesce(cm.total_seats_available, 0)::int as total_seats_available,
  coalesce(cm.full_sections_count, 0)::int as full_sections_count,
  coalesce(cm.low_fill_sections_count, 0)::int as low_fill_sections_count,
  coalesce(cm.total_levels, 0)::int as total_levels,

  -- Élèves (5)
  coalesce(sm.students_total, 0)::int as students_total,
  coalesce(sm.students_new_30d, 0)::int as students_new_30d,
  coalesce(sm.students_new_7d, 0)::int as students_new_7d,
  coalesce(sm.students_avg_age, 0) as students_avg_age,

  -- Paiements (9)
  coalesce(pm.pay_total_collected, 0) as pay_total_collected,
  coalesce(pm.pay_total_pending, 0) as pay_total_pending,
  coalesce(pm.pay_total_remaining, 0) as pay_total_remaining,
  coalesce(pm.pay_recovery_rate_pct, 0) as pay_recovery_rate_pct,
  coalesce(pm.pay_confirmed_count, 0)::int as pay_confirmed_count,
  coalesce(pm.pay_pending_count, 0)::int as pay_pending_count,
  coalesce(pm.pay_failed_count, 0)::int as pay_failed_count,
  coalesce(pm.fees_overdue_count, 0)::int as fees_overdue_count,
  coalesce(pm.pay_high_risk_count, 0)::int as pay_high_risk_count,

  -- Documents (5)
  coalesce(dm.docs_avg_completeness_pct, 100) as docs_avg_completeness_pct,
  coalesce(dm.docs_total_required, 0)::int as docs_total_required,
  coalesce(dm.docs_total_validated, 0)::int as docs_total_validated,
  coalesce(dm.docs_total_missing, 0)::int as docs_total_missing,
  coalesce(dm.docs_students_incomplete, 0)::int as docs_students_incomplete,

  -- Notes / évaluation (4)
  coalesce(gm.grades_total_count, 0)::int as grades_total_count,
  coalesce(gm.grades_overall_average, 0) as grades_overall_average,
  coalesce(gm.grades_avg_30d, 0) as grades_avg_30d,
  coalesce(gm.grades_recorded_7d, 0)::int as grades_recorded_7d,

  -- Élèves à risque (3)
  coalesce(ar.students_at_risk_count, 0)::int as students_at_risk_count,
  coalesce(ar.students_at_risk_high, 0)::int as students_at_risk_high,
  coalesce(ar.students_at_risk_medium, 0)::int as students_at_risk_medium,

  -- Comportement (3)
  coalesce(bm.beh_total_notes_30d, 0)::int as beh_total_notes_30d,
  coalesce(bm.beh_incidents_30d, 0)::int as beh_incidents_30d,
  coalesce(bm.beh_a_surveiller_30d, 0)::int as beh_a_surveiller_30d,

  -- Messages (3)
  coalesce(mm.msg_total_30d, 0)::int as msg_total_30d,
  coalesce(mm.msg_unread_count, 0)::int as msg_unread_count,
  mm.msg_read_rate_pct as msg_read_rate_pct,

  -- Présence classe (4)
  coalesce(am2.att_total_records_30d, 0)::int as att_total_records_30d,
  coalesce(am2.att_present_count_30d, 0)::int as att_present_count_30d,
  coalesce(am2.att_absent_count_30d, 0)::int as att_absent_count_30d,
  am2.att_rate_pct_30d as att_rate_pct_30d,

  -- Internat (8)
  coalesce(im.int_total_beds, 0)::int as int_total_beds,
  coalesce(im.int_occupied_beds, 0)::int as int_occupied_beds,
  coalesce(im.int_free_beds, 0)::int as int_free_beds,
  coalesce(im.int_occupancy_rate_pct, 0) as int_occupancy_rate_pct,
  coalesce(im.int_incidents_7d, 0)::int as int_incidents_7d,
  coalesce(im.int_incidents_30d, 0)::int as int_incidents_30d,
  coalesce(im.int_grave_open_incidents, 0)::int as int_grave_open_incidents,
  coalesce(im.int_visits_today, 0)::int as int_visits_today,

  -- Secrétariat (4)
  coalesce(sm2.sec_total_pending_actions, 0)::int as sec_total_pending_actions,
  coalesce(sm2.sec_students_incomplete_docs, 0)::int as sec_students_incomplete_docs,
  coalesce(sm2.sec_pending_payment_count, 0)::int as sec_pending_payment_count,
  coalesce(sm2.sec_reservations_today, 0)::int as sec_reservations_today,

  -- Répartition élèves par niveau (1)
  sl.students_by_level

from public.establishments e
left join auth_metrics am on am.eid = e.id
left join dup_accounts da on da.eid = e.id
left join team_metrics tm on tm.eid = e.id
left join res_metrics rm on rm.eid = e.id
left join class_metrics cm on cm.eid = e.id
left join student_metrics sm on sm.eid = e.id
left join student_by_level sl on sl.eid = e.id
left join pay_metrics pm on pm.eid = e.id
left join doc_metrics dm on dm.eid = e.id
left join grade_metrics gm on gm.eid = e.id
left join at_risk_aggregated ar on ar.eid = e.id
left join behavior_metrics bm on bm.eid = e.id
left join message_metrics mm on mm.eid = e.id
left join attendance_metrics am2 on am2.eid = e.id
left join internat_metrics im on im.eid = e.id
left join secretariat_metrics sm2 on sm2.eid = e.id
cross join parents_no_establishment pn;

grant select on public.school_health_overview to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Fonction : score de santé école (0..100, + = mieux)
-- ----------------------------------------------------------------------------
-- Pondère : occupation des places, taux de recouvrement, taux de présence,
-- documents incomplets, élèves à risque, incidents graves ouverts, classes pleines.
create or replace function public.compute_school_health_score(
  p_establishment_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.school_health_overview%rowtype;
  v_score numeric := 100;
begin
  select * into v
  from public.school_health_overview
  where establishment_id = p_establishment_id;

  if not found then
    return 0;
  end if;

  -- 1) Occupation des places (idéal ~80%, pénalité si saturé ou vide)
  if v.total_capacity > 0 then
    if v.fill_rate_pct >= 100 then
      v_score := v_score - 20;
    elseif v.fill_rate_pct < 30 then
      v_score := v_score - 15;
    end if;
  end if;

  -- 2) Taux de recouvrement des paiements (40 pts max)
  if v.pay_recovery_rate_pct < 100 then
    v_score := v_score - round((100 - v.pay_recovery_rate_pct) * 0.4);
  end if;

  -- 3) Taux de présence (15 pts)
  if v.att_rate_pct_30d is not null and v.att_rate_pct_30d < 90 then
    v_score := v_score - round((90 - v.att_rate_pct_30d) * 0.15);
  end if;

  -- 4) Documents incomplets (1 pt par élève)
  v_score := v_score - v.docs_students_incomplete;

  -- 5) Élèves à risque élevé (5 pts chacun)
  v_score := v_score - (v.students_at_risk_high * 5);

  -- 6) Incidents graves ouverts d'internat (10 pts chacun)
  v_score := v_score - (v.int_grave_open_incidents * 10);

  -- 7) Sections pleines / sous-remplies
  v_score := v_score - (v.full_sections_count * 2);

  return greatest(0, least(100, round(v_score)));
end;
$$;

grant execute on function public.compute_school_health_score(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Fonction : rapport de santé complet (JSON agrémenté)
-- ----------------------------------------------------------------------------
create or replace function public.school_health_report(
  p_establishment_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select to_jsonb(ovr.*) into v
  from public.school_health_overview ovr
  where ovr.establishment_id = p_establishment_id;

  if v is null then
    return jsonb_build_object('error', 'Établissement introuvable');
  end if;

  return v || jsonb_build_object(
    'health_score', public.compute_school_health_score(p_establishment_id),
    'generated_at', now()
  );
end;
$$;

grant execute on function public.school_health_report(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : classement des établissements par score de santé
-- ----------------------------------------------------------------------------
create or replace view public.school_health_ranking as
select
  e.id as establishment_id,
  e.name as establishment_name,
  e.city,
  e.school_type,
  public.compute_school_health_score(e.id) as health_score,
  ovr.students_total,
  ovr.fill_rate_pct,
  ovr.pay_recovery_rate_pct,
  ovr.auth_active_sessions_24h,
  ovr.students_at_risk_high,
  ovr.int_grave_open_incidents,
  ovr.sec_total_pending_actions
from public.establishments e
left join public.school_health_overview ovr on ovr.establishment_id = e.id
order by public.compute_school_health_score(e.id) desc nulls last;

grant select on public.school_health_ranking to authenticated, service_role;
