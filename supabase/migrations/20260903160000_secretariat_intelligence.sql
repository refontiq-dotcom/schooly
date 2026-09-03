-- ============================================================================
-- SCHOOLY v1 — Secrétariat intelligent
-- ============================================================================
-- Ajoute au module Secrétariat :
--   * vue agrégée "actions du jour" (réservations + paiements + docs + QR expirés) ;
--   * complétude dossiers par élève (% docs requis présents) ;
--   * file d'attente QR codes à scanner ;
--   * historique d'actions (réservations finalisées, paiements confirmés) ;
--   * fonction de finalisation atomique (réservation + paiement + section).
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : complétude dossier par élève
-- ----------------------------------------------------------------------------
create or replace view public.student_documents_completeness as
with counts as (
  select
    s.id as student_id,
    s.establishment_id,
    s.full_name,
    sec.name as section_name,
    count(sd.id) filter (where sd.required) as required_total,
    count(sd.id) filter (where sd.required and sd.status = 'validated') as required_validated,
    count(sd.id) filter (where sd.required and sd.status = 'submitted') as required_submitted,
    count(sd.id) filter (where sd.required and sd.status = 'missing') as required_missing
  from public.students s
  left join public.sections sec on sec.id = s.section_id
  left join public.student_documents sd on sd.student_id = s.id
  group by s.id, s.establishment_id, s.full_name, sec.name
)
select
  student_id,
  establishment_id,
  full_name,
  section_name,
  coalesce(required_total, 0) as required_total,
  coalesce(required_validated, 0) as required_validated,
  coalesce(required_submitted, 0) as required_submitted,
  coalesce(required_missing, 0) as required_missing,
  case when coalesce(required_total, 0) = 0 then 100
    else round(100.0 * required_validated / required_total)
  end as completeness_pct,
  case
    when coalesce(required_total, 0) = 0 then 'complete'
    when required_missing = 0 and required_submitted = 0 then 'complete'
    when required_missing = 0 and required_submitted > 0 then 'pending_validation'
    else 'incomplete'
  end as status
from counts;

grant select on public.student_documents_completeness to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : élèves avec dossier incomplet
-- ----------------------------------------------------------------------------
create or replace view public.students_missing_documents as
select *
from public.student_documents_completeness
where status in ('incomplete', 'pending_validation')
order by required_missing desc, full_name;

grant select on public.students_missing_documents to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : QR codes en attente de scan
-- ----------------------------------------------------------------------------
create or replace view public.pending_qr_finalizations as
select
  r.id as reservation_id,
  r.establishment_id,
  r.qr_code_token,
  r.student_full_name,
  r.parent_full_name,
  r.parent_phone,
  r.amount_paid,
  r.status as reservation_status,
  r.expires_at,
  r.created_at,
  case
    when r.expires_at is not null and r.expires_at < now() then 'expired'
    when r.status = 'pending_payment' then 'awaiting_payment'
    when r.status = 'reserved' then 'awaiting_scan'
    else 'unknown'
  end as finalization_state
from public.reservations r
where r.status in ('pending_payment', 'reserved')
order by r.created_at desc;

grant select on public.pending_qr_finalizations to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : actions du secrétariat aujourd'hui (agrégat)
-- ----------------------------------------------------------------------------
create or replace view public.secretariat_daily_actions as
with today_reservations as (
  select
    establishment_id,
    count(*) as reservations_today,
    count(*) filter (where status = 'pending_payment') as pending_payment_count,
    count(*) filter (where status = 'reserved') as reserved_count
  from public.reservations
  where created_at::date = current_date
  group by establishment_id
),
today_payments as (
  select
    establishment_id,
    count(*) as payments_today,
    count(*) filter (where status = 'pending') as payments_pending,
    coalesce(sum(amount) filter (where status = 'pending'), 0) as pending_amount
  from public.payments
  where created_at::date = current_date
  group by establishment_id
),
docs_incomplete as (
  select
    establishment_id,
    count(*) as students_with_incomplete_docs
  from public.student_documents_completeness
  where status in ('incomplete', 'pending_validation')
  group by establishment_id
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(tr.reservations_today, 0) as reservations_today,
  coalesce(tr.pending_payment_count, 0) as pending_payment_count,
  coalesce(tr.reserved_count, 0) as reserved_count,
  coalesce(tp.payments_today, 0) as payments_today,
  coalesce(tp.payments_pending, 0) as payments_pending,
  coalesce(tp.pending_amount, 0) as pending_amount,
  coalesce(di.students_with_incomplete_docs, 0) as students_with_incomplete_docs,
  coalesce(tr.reservations_today, 0)
    + coalesce(tp.payments_pending, 0)
    + coalesce(di.students_with_incomplete_docs, 0) as total_pending_actions
from public.establishments e
left join today_reservations tr on tr.establishment_id = e.id
left join today_payments tp on tp.establishment_id = e.id
left join docs_incomplete di on di.establishment_id = e.id;

grant select on public.secretariat_daily_actions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : historique actions récentes (finalisations + paiements)
-- ----------------------------------------------------------------------------
create or replace view public.secretariat_recent_actions as
with finalized as (
  select
    r.id,
    r.establishment_id,
    'reservation_finalized' as action_type,
    r.student_full_name as target_name,
    r.confirmed_by as actor_id,
    r.confirmed_at as action_at,
    jsonb_build_object('amount_paid', r.amount_paid, 'payment_reference', r.payment_reference) as metadata
  from public.reservations r
  where r.status in ('confirmed', 'reserved') and r.confirmed_at is not null
),
paid as (
  select
    p.id,
    p.establishment_id,
    'payment_confirmed' as action_type,
    s.full_name as target_name,
    p.recorded_by as actor_id,
    p.paid_at as action_at,
    jsonb_build_object('amount', p.amount, 'method', p.method, 'reference', p.reference) as metadata
  from public.payments p
  join public.students s on s.id = p.student_id
  where p.status = 'paid' and p.paid_at is not null
)
select * from finalized
union all
select * from paid
order by action_at desc;

grant select on public.secretariat_recent_actions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : finalisation atomique d'une réservation
-- ----------------------------------------------------------------------------
-- Marque la réservation comme 'confirmed' + crée l'élève final + assigne
-- automatiquement la section la moins pleine si section_id fourni NULL.
-- Renvoie l'ID de la réservation + l'ID de l'élève créé.
create or replace function public.finalize_reservation(
  p_reservation_id uuid,
  p_section_id uuid default null,
  p_actor_id uuid default null
) returns table(reservation_id uuid, student_id uuid, section_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_section_id uuid;
  v_student_id uuid;
begin
  -- 1. Récupérer la réservation
  select * into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation % not found', p_reservation_id;
  end if;

  if v_res.status not in ('pending_payment', 'reserved') then
    raise exception 'Reservation % cannot be finalized (status=%)', p_reservation_id, v_res.status;
  end if;

  -- 2. Déterminer la section
  v_section_id := coalesce(p_section_id, v_res.section_id);

  if v_section_id is null then
    -- Suggérer automatiquement la section la moins pleine
    select s.id into v_section_id
    from public.sections s
    where s.level_id = v_res.level_id
      and s.seats_taken < s.capacity
    order by (s.capacity - s.seats_taken) desc, s.seats_taken asc
    limit 1;
  end if;

  if v_section_id is null then
    raise exception 'No section available for level %', v_res.level_id;
  end if;

  -- 3. Vérifier la capacité
  if (select seats_taken from public.sections where id = v_section_id) >=
     (select capacity from public.sections where id = v_section_id) then
    raise exception 'Section % is full', v_section_id;
  end if;

  -- 4. Créer l'élève (schema v1: pas d'enrollment_status)
  insert into public.students (
    establishment_id,
    section_id,
    full_name,
    birthdate,
    parent_phone
  ) values (
    v_res.establishment_id,
    v_section_id,
    v_res.student_full_name,
    v_res.student_birthdate,
    coalesce(v_res.parent_phone, '')
  )
  returning id into v_student_id;

  -- 5. Incrémenter seats_taken de la section
  update public.sections
  set seats_taken = seats_taken + 1
  where id = v_section_id;

  -- 6. Marquer la réservation comme confirmée
  update public.reservations
  set
    status = 'confirmed',
    section_id = v_section_id,
    confirmed_at = now(),
    confirmed_by = p_actor_id
  where id = p_reservation_id;

  return query select p_reservation_id, v_student_id, v_section_id;
end;
$$;

grant execute on function public.finalize_reservation(uuid, uuid, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : taux de complétude moyen d'un établissement
-- ----------------------------------------------------------------------------
create or replace function public.compute_establishment_docs_completeness(
  p_establishment_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_avg numeric;
begin
  select round(avg(completeness_pct)::numeric, 1)
    into v_avg
  from public.student_documents_completeness
  where establishment_id = p_establishment_id;

  return coalesce(v_avg, 100);
end;
$$;

grant execute on function public.compute_establishment_docs_completeness(uuid) to authenticated, service_role;
