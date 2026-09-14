-- ============================================================================
-- SCHOOLY v1 — Paiements intelligents
-- ============================================================================
-- Ce script ajoute au module Paiements :
--   * un scoring de risque d'impayé (0..100) par élève/famille ;
--   * des vues agrégées temps réel pour le dashboard admin (CA, recouvrement,
--     retards, répartition par méthode) ;
--   * une détection automatique d'anomalies (montants hors bornes, doublons
--     rapides, références incohérentes) ;
--   * une table de réconciliation Mobile Money (rapprochement des paiements
--     entrants avec les statements des opérateurs) ;
--   * une fonction de génération automatique d'échéances (échéancier annuel) ;
--   * une fonction de notification de retard (file d'attente pour WhatsApp
--     en Phase 2).
--
-- IMPORTANT : ce script est idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes enrichies sur les paiements et frais
-- ----------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_risk_score int
    check (payment_risk_score is null or (payment_risk_score between 0 and 100));

alter table public.payments
  add column if not exists anomaly_flags text[] not null default '{}';

alter table public.payments
  add column if not exists reconciled_at timestamptz;

alter table public.payments
  add column if not exists reconciled_by uuid references profiles(id);

alter table public.payments
  add column if not exists reconciliation_note text;

alter table public.student_fees
  add column if not exists late_days int not null default 0;

alter table public.student_fees
  add column if not exists payment_risk_score int
    check (payment_risk_score is null or (payment_risk_score between 0 and 100));

create index if not exists idx_payments_risk_score
  on public.payments (payment_risk_score)
  where payment_risk_score is not null;

create index if not exists idx_payments_status_method
  on public.payments (establishment_id, status, method);

create index if not exists idx_student_fees_overdue
  on public.student_fees (establishment_id, due_date)
  where status in ('pending', 'overdue');

-- ----------------------------------------------------------------------------
-- 2. Table : réconciliation Mobile Money
-- ----------------------------------------------------------------------------
create table if not exists public.payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  provider text not null,                          -- 'orange_money' | 'mtn_momo' | 'wave' | 'moov'
  statement_date date not null,
  external_reference text not null,               -- ID du transfert côté opérateur
  external_amount numeric(12,2) not null,
  external_phone text,
  payment_id uuid references payments(id) on delete set null,
  matched_at timestamptz,
  matched_by uuid references profiles(id),
  status text not null default 'unmatched'         -- 'unmatched' | 'matched' | 'ignored' | 'ambiguous'
    check (status in ('unmatched', 'matched', 'ignored', 'ambiguous')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reconciliation_status
  on public.payment_reconciliations (establishment_id, status, statement_date desc);

create index if not exists idx_reconciliation_external_ref
  on public.payment_reconciliations (provider, external_reference);

-- ----------------------------------------------------------------------------
-- 3. FONCTION : calcul du score de risque d'impayé (0..100)
-- ----------------------------------------------------------------------------
-- 0 = aucun risque (paiement fiable) ; 100 = impayé quasi certain.
-- Calcule sur l'historique des paiements du parent (téléphone normalisé).
create or replace function public.compute_payment_risk_score(
  p_establishment_id uuid,
  p_parent_phone text
) returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int := 0;
  v_confirmed int := 0;
  v_failed int := 0;
  v_overdue int := 0;
  v_late_days_avg numeric := 0;
  v_score int := 0; -- baseline : 0 = bon payeur
  v_phone_normalized text;
begin
  v_phone_normalized := regexp_replace(coalesce(p_parent_phone, ''), '\s+', '', 'g');
  if v_phone_normalized = '' then return 50; end if;

  -- Agrège sur tous les paiements + frais du parent dans cet établissement
  select
    count(*) filter (where true),
    count(*) filter (where pay.status = 'confirmed'),
    count(*) filter (where pay.status = 'failed'),
    count(*) filter (where sf.status = 'overdue')
  into v_total, v_confirmed, v_failed, v_overdue
  from public.payments pay
  join public.students s on s.id = pay.student_id
  where pay.establishment_id = p_establishment_id
    and regexp_replace(coalesce(s.parent_phone, ''), '\s+', '', 'g') = v_phone_normalized;

  select coalesce(avg(sf.late_days), 0) into v_late_days_avg
  from public.student_fees sf
  join public.students s on s.id = sf.student_id
  where sf.establishment_id = p_establishment_id
    and regexp_replace(coalesce(s.parent_phone, ''), '\s+', '', 'g') = v_phone_normalized
    and sf.late_days > 0;

  if v_total = 0 then
    -- Nouveau payeur : risque neutre
    return 30;
  end if;

  -- Base : taux d'échec (failed + overdue) sur total
  v_score := round(50.0 * (v_failed + v_overdue)::numeric / v_total)::int;

  -- Bonus : retard moyen (1 point par jour moyen, plafonné +20)
  v_score := v_score + least(round(v_late_days_avg)::int, 20);

  -- Bonus : aucun paiement confirmé (-10 = fiable)
  if v_confirmed = 0 then
    v_score := v_score + 15;
  end if;

  -- Clamp 0..100
  return greatest(0, least(100, v_score));
end;
$$;

revoke all on function public.compute_payment_risk_score(uuid, text) from public, anon;
grant execute on function public.compute_payment_risk_score(uuid, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. FONCTION : détection d'anomalies sur un paiement
-- ----------------------------------------------------------------------------
-- Retourne un tableau de flags : AMOUNT_OUTLIER, RAPID_DUPLICATE, REF_INVALID,
-- STUDENT_BELONGS_TO_OTHER_ETAB.
create or replace function public.detect_payment_anomaly(
  p_payment_id uuid
) returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_fee public.student_fees;
  v_flags text[] := '{}';
  v_dup_count int;
  v_avg_amount numeric;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then return array['NOT_FOUND']; end if;

  -- 1) Montant aberrant (>5× moyenne des paiements de l'établissement)
  select avg(amount) into v_avg_amount
  from public.payments
  where establishment_id = v_payment.establishment_id
    and status = 'confirmed'
    and created_at > now() - interval '90 days';

  if v_avg_amount is not null and v_payment.amount > v_avg_amount * 5 then
    v_flags := array_append(v_flags, 'AMOUNT_OUTLIER');
  end if;

  if v_payment.amount <= 0 then
    v_flags := array_append(v_flags, 'AMOUNT_OUTLIER');
  end if;

  -- 2) Doublon rapide (même montant + même référence + même student < 5 min)
  if v_payment.reference is not null then
    select count(*) into v_dup_count
    from public.payments
    where student_id = v_payment.student_id
      and reference = v_payment.reference
      and amount = v_payment.amount
      and id <> v_payment.id
      and created_at > now() - interval '5 minutes';

    if v_dup_count > 0 then
      v_flags := array_append(v_flags, 'RAPID_DUPLICATE');
    end if;
  end if;

  -- 3) Référence incohérente (trop courte ou trop longue)
  if v_payment.reference is not null
     and (length(v_payment.reference) < 4 or length(v_payment.reference) > 64) then
    v_flags := array_append(v_flags, 'REF_INVALID');
  end if;

  -- 4) Frais associé hors établissement
  if v_payment.student_fee_id is not null then
    select * into v_fee from public.student_fees where id = v_payment.student_fee_id;
    if v_fee is not null and v_fee.establishment_id <> v_payment.establishment_id then
      v_flags := array_append(v_flags, 'STUDENT_BELONGS_TO_OTHER_ETAB');
    end if;
  end if;

  return v_flags;
end;
$$;

revoke all on function public.detect_payment_anomaly(uuid) from public, anon;
grant execute on function public.detect_payment_anomaly(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : confirmation idempotente + recalcul des statuts
-- ----------------------------------------------------------------------------
create or replace function public.confirm_fee_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_payment public.payments;
  v_anomaly_flags text[];
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.role not in ('admin', 'secretariat', 'censeur') then
    raise exception 'Accès refusé';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Paiement introuvable'; end if;

  if v_profile.establishment_id is distinct from v_payment.establishment_id then
    raise exception 'Autre établissement';
  end if;

  -- Idempotent : déjà confirmé
  if v_payment.status = 'confirmed' then return v_payment; end if;

  -- Détection d'anomalies (informatif, ne bloque pas)
  v_anomaly_flags := public.detect_payment_anomaly(p_payment_id);

  update public.payments
    set status = 'confirmed',
        paid_at = now(),
        anomaly_flags = v_anomaly_flags,
        payment_risk_score = public.compute_payment_risk_score(
          v_payment.establishment_id,
          (select parent_phone from public.students where id = v_payment.student_id)
        )
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.student_fee_id is not null then
    update public.student_fees
      set amount_paid = least(amount, amount_paid + v_payment.amount),
          late_days = greatest(
            0,
            coalesce(late_days, 0) + greatest(0, (current_date - coalesce(due_date, current_date)))
          )
      where id = v_payment.student_fee_id;
    perform public.refresh_fee_status(v_payment.student_fee_id);
  end if;

  return v_payment;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : génération automatique d'échéances (échéancier annuel)
-- ----------------------------------------------------------------------------
-- À appeler en début d'année scolaire. Pour chaque élève de l'établissement,
-- crée les `student_fees` pour toutes les `fee_categories` non encore assignées.
create or replace function public.generate_yearly_schedule(
  p_establishment_id uuid,
  p_school_year text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  insert into public.student_fees (student_id, fee_category_id, establishment_id, amount, due_date)
  select s.id, fc.id, fc.establishment_id, fc.amount, fc.due_date
  from public.students s
  cross join public.fee_categories fc
  where s.establishment_id = p_establishment_id
    and fc.establishment_id = p_establishment_id
    and fc.school_year = p_school_year
    and not exists (
      select 1 from public.student_fees sf
      where sf.student_id = s.id
        and sf.fee_category_id = fc.id
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.generate_yearly_schedule(uuid, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : marquer un frais comme "relancé" (trace la relance)
-- ----------------------------------------------------------------------------
create table if not exists public.fee_reminders (
  id uuid primary key default gen_random_uuid(),
  student_fee_id uuid not null references student_fees(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'email', 'in_app')),
  sent_at timestamptz not null default now(),
  sent_by uuid references profiles(id),
  note text
);

create index if not exists idx_fee_reminders_fee
  on public.fee_reminders (student_fee_id, sent_at desc);

alter table public.fee_reminders enable row level security;

drop policy if exists "fee_reminders_staff" on public.fee_reminders;
create policy "fee_reminders_staff" on public.fee_reminders for all
  using (student_fee_id in (
    select id from public.student_fees
    where establishment_id in (select establishment_id from public.profiles where id = auth.uid())
  ));

-- ----------------------------------------------------------------------------
-- 8. Vue : vue d'ensemble paiements (dashboard admin)
-- ----------------------------------------------------------------------------
create or replace view public.payment_overview as
select
  e.id as establishment_id,
  e.name as establishment_name,
  -- CA encaissé (paiements confirmés)
  coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0) as total_collected,
  -- CA en attente
  coalesce(sum(p.amount) filter (where p.status = 'pending'), 0) as total_pending,
  -- Restant dû (frais non payés)
  coalesce(sum(sf.amount - sf.amount_paid) filter (where sf.status in ('pending', 'overdue', 'partial')), 0) as total_remaining,
  -- Taux de recouvrement (collected / (collected + remaining))
  case
    when coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0) +
         coalesce(sum(sf.amount - sf.amount_paid) filter (where sf.status in ('pending', 'overdue', 'partial')), 0) = 0 then 0
    else round(
      100.0 * coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
      / nullif(
        coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
        + coalesce(sum(sf.amount - sf.amount_paid) filter (where sf.status in ('pending', 'overdue', 'partial')), 0),
        0)
    )
  end as recovery_rate_pct,
  -- Nombre de paiements par statut
  count(*) filter (where p.status = 'confirmed') as confirmed_count,
  count(*) filter (where p.status = 'pending') as pending_count,
  count(*) filter (where p.status = 'failed') as failed_count,
  -- Frais en retard
  count(*) filter (where sf.status = 'overdue') as overdue_count,
  count(*) filter (where sf.status = 'partial') as partial_count,
  -- Répartition par méthode
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'orange_money'), 0) as orange_money_total,
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'mtn_momo'), 0) as mtn_momo_total,
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'wave'), 0) as wave_total,
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'moov'), 0) as moov_total,
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'cash'), 0) as cash_total,
  coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.method = 'bank'), 0) as bank_total
from public.establishments e
left join public.payments p on p.establishment_id = e.id
left join public.student_fees sf on sf.establishment_id = e.id
group by e.id, e.name;

grant select on public.payment_overview to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Vue : CA mensuel (12 derniers mois)
-- ----------------------------------------------------------------------------
create or replace view public.monthly_revenue as
select
  establishment_id,
  date_trunc('month', paid_at) as month,
  sum(amount) filter (where status = 'confirmed') as confirmed_total,
  sum(amount) filter (where status = 'pending') as pending_total,
  sum(amount) filter (where status = 'failed') as failed_total,
  count(*) filter (where status = 'confirmed') as confirmed_count
from public.payments
where paid_at is not null
  and paid_at > now() - interval '12 months'
group by establishment_id, date_trunc('month', paid_at)
order by establishment_id, month desc;

grant select on public.monthly_revenue to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. Vue : frais en retard (top impayés)
-- ----------------------------------------------------------------------------
create or replace view public.overdue_fees as
select
  sf.id,
  sf.establishment_id,
  sf.student_id,
  s.full_name as student_name,
  s.parent_phone,
  fc.name as fee_category,
  sf.amount,
  sf.amount_paid,
  (sf.amount - sf.amount_paid) as remaining,
  sf.due_date,
  current_date - sf.due_date as days_late,
  sf.payment_risk_score,
  coalesce(sf.late_days, 0) as late_days
from public.student_fees sf
join public.students s on s.id = sf.student_id
join public.fee_categories fc on fc.id = sf.fee_category_id
where sf.status in ('overdue', 'partial')
  and sf.due_date is not null
  and sf.due_date < current_date
order by days_late desc;

grant select on public.overdue_fees to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. Vue : paiements anormaux (audit)
-- ----------------------------------------------------------------------------
create or replace view public.payment_anomalies as
select
  p.id,
  p.establishment_id,
  p.student_id,
  s.full_name as student_name,
  s.parent_phone,
  p.amount,
  p.method,
  p.reference,
  p.status,
  p.anomaly_flags,
  p.created_at
from public.payments p
join public.students s on s.id = p.student_id
where array_length(p.anomaly_flags, 1) > 0
order by p.created_at desc;

grant select on public.payment_anomalies to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. Vue : paiements à haut risque (pour relances ciblées)
-- ----------------------------------------------------------------------------
create or replace view public.high_risk_payments as
select
  p.id,
  p.establishment_id,
  p.student_id,
  s.full_name as student_name,
  s.parent_phone,
  p.amount,
  p.method,
  p.reference,
  p.status,
  p.payment_risk_score,
  p.created_at
from public.payments p
join public.students s on s.id = p.student_id
where p.payment_risk_score >= 60
order by p.payment_risk_score desc, p.created_at desc;

grant select on public.high_risk_payments to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 13. Vue : reste à payer par élève (dashboard parent)
-- ----------------------------------------------------------------------------
create or replace view public.student_payment_summary as
select
  s.id as student_id,
  s.establishment_id,
  s.full_name,
  s.parent_id,
  coalesce(sum(sf.amount), 0) as total_fees,
  coalesce(sum(sf.amount_paid), 0) as total_paid,
  coalesce(sum(sf.amount - sf.amount_paid), 0) as total_remaining,
  count(*) filter (where sf.status = 'paid') as paid_count,
  count(*) filter (where sf.status = 'overdue') as overdue_count,
  count(*) filter (where sf.status = 'pending') as pending_count,
  count(*) filter (where sf.status = 'partial') as partial_count,
  min(sf.due_date) filter (where sf.status in ('pending', 'partial', 'overdue') and sf.amount_paid < sf.amount) as next_due_date
from public.students s
left join public.student_fees sf on sf.student_id = s.id
group by s.id, s.establishment_id, s.full_name, s.parent_id;

grant select on public.student_payment_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 14. RLS : un parent voit le reste à payer de son enfant (déjà couvert
-- par sfees_parent) ; staff voit tout.
-- ----------------------------------------------------------------------------
alter table public.payment_reconciliations enable row level security;

drop policy if exists "reconciliation_staff" on public.payment_reconciliations;
create policy "reconciliation_staff" on public.payment_reconciliations for all
  using (establishment_id in (
    select establishment_id from public.profiles where id = auth.uid()
      and role in ('admin', 'secretariat', 'censeur')
  ));

-- ----------------------------------------------------------------------------
-- 15. Cron job : mise à jour automatique des frais en retard
-- ----------------------------------------------------------------------------
-- À planifier via pg_cron (1×/jour).
create or replace function public.mark_overdue_fees() returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update public.student_fees
    set status = 'overdue',
        late_days = current_date - due_date
    where status = 'pending'
      and due_date is not null
      and due_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 16. Grants finaux
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.payment_reconciliations to authenticated;
grant select, insert, update, delete on public.fee_reminders to authenticated;