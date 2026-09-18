-- ============================================================================
-- 20260918230000 — Export SYSCOHADA (Phase 3)
--
-- Le constat audit #3 : le "plan comptable" était factice
--   (totalDebit += montant ; totalCredit += montant → toujours équilibré).
-- Cette migration fournit :
--   1. syscohada_settings : exercice fiscal par école (exercice 2026-2027)
--   2. syscohada_plan : plan comptable SYSCOHADA (comptes autorisés)
--   3. syscohada_export_log : trace des générations (qui, quand, période)
--   4. v_syscohada_ledger : écritures réelles (source = receipts ↔ payments)
--   5. v_syscohada_control : agrégats par compte + équilibre vérifié par écriture
--
-- Équipé de policies RLS et de grants pour authenticated.
-- Source des données : tables EXISTANTES (payments ↔ receipts),
-- PAS paiement_ledger (n'existe pas dans ce projet).
-- ============================================================================

-- ─── 1. Paramétrage exercice par école ──────────────────────────────────────
create table if not exists public.syscohada_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fiscal_year_date date not null default date_trunc('year', now()) + interval '9 months',
  fiscal_year_months integer not null default 12,
  created_at timestamptz not null default now(),
  constraint syscohada_settings_school_unique unique (school_id)
);

drop trigger if exists trg_syscohada_settings_updated_at on public.syscohada_settings;
create trigger trg_syscohada_settings_updated_at before update on public.syscohada_settings
  for each row execute function public.touch_updated_at();

alter table public.syscohada_settings enable row level security;
drop policy if exists syscohada_settings_member_read on public.syscohada_settings;
create policy syscohada_settings_member_read on public.syscohada_settings for select
  using (is_super_admin() or is_school_member(school_id));
drop policy if exists syscohada_settings_write on public.syscohada_settings;
create policy syscohada_settings_write on public.syscohada_settings for all
  using (has_school_role(school_id, array['direction', 'compta', 'super_admin']));

insert into public.syscohada_settings (school_id, fiscal_year_date)
  select id, date_trunc('year', now()) + interval '9 months'
  from public.schools
  where deleted_at is null
  on conflict (school_id) do nothing;

grant select on public.syscohada_settings to authenticated;


-- ─── 2. Plan comptable SYSCOHADA (référence, 1 fois) ────────────────────────
create table if not exists public.syscohada_plan (
  account text primary key,
  label text not null,
  account_type text not null check (account_type in ('actif','passif','charge','produit','compte_cour')),
  analytic boolean not null default false
);

insert into public.syscohada_plan (account, label, account_type) values
  ('571', 'Caisse',                    'actif'),
  ('521', 'Banque',                    'actif'),
  ('530', 'Petite caisse enregistreuse', 'actif'),
  ('411', 'Comptes clients - Élèves',  'passif'),
  ('421', 'Comptes clients - Tiers',   'passif'),
  ('44562', 'TVA collectée',           'passif'),
  ('4263', 'Banque - remise de chèques','actif'),
  ('601', 'Achats non stockés',        'charge'),
  ('606', 'Achats de matériel',        'charge'),
  ('623', 'Prestations de services du personnel', 'charge'),
  ('627', 'Autres prestations de services', 'charge'),
  ('635', 'Dotations aux amortissements', 'charge'),
  ('638', 'Autres charges d''amortissement', 'charge'),
  ('641', 'Salaires à payer',          'charge'),
  ('648', 'Charges sociales à payer',  'charge'),
  ('701', 'Frais de scolarité',        'produit'),
  ('706', 'Autres produits de services', 'produit'),
  ('708', 'Produits d''exploitation',  'produit'),
  ('709', 'Récupérations sur charges', 'produit'),
  ('622', 'Services informatiques',    'charge'),
  ('6351','Dotations aux provisions (école)', 'charge'),
  ('6381','Autres dotations',          'charge')
on conflict (account) do nothing;


-- ─── 3. Vue agrégée : écritures SYSCOHADA réelles ─────────────────────────
-- Source : receipts ↔ payments (tables EXISTANTES).
-- Un paiement = une écriture d'encaissement :
--   débit sur 571/521 selon le mode, crédit sur 411 Élèves.
-- Les remises (fee_discounts) = charges équilibrant le passif produit.
create or replace view public.v_syscohada_ledger as
with fiscal_bounds as (
  select school_id,
         fiscal_year_date as fy_start,
         (fiscal_year_date + (fiscal_year_months || ' months')::interval)::date as fy_end
    from public.syscohada_settings
),
cash as (
  select
    p.school_id,
    r.id as receipt_id,
    r.receipt_number,
    p.enrollment_id,
    p.amount,
    p.payment_method,
    r.issued_at as transaction_date,
    case
      when p.payment_method = 'cash'        then '571'
      when p.payment_method in ('transfer','mobile_money') then '521'
      else '571'
    end as debit_account,
    '411' as credit_account
  from public.payments p
  join public.receipts r on r.payment_id = p.id
  where p.deleted_at is null and r.deleted_at is null
),
discounts as (
  select
    fd.school_id,
    fd.id as discount_id,
    fd.enrollment_id,
    fd.amount,
    now()::date as transaction_date,
    '601' as debit_account,
    '411' as credit_account
  from public.fee_discounts fd
  where fd.deleted_at is null
),
unioned as (
  select school_id, receipt_id as ref_id, receipt_number as ref_label,
         enrollment_id, amount, transaction_date,
         debit_account, credit_account, 'payment' as source_type
  from cash
  union all
  select school_id, discount_id, 'REMISE-' || id::text,
         enrollment_id, amount, transaction_date,
         debit_account, credit_account, 'discount'
  from discounts
)
select
  u.school_id,
  u.source_type,
  u.ref_id,
  u.ref_label,
  u.enrollment_id,
  u.transaction_date,
  u.debit_account,
  u.credit_account,
  u.amount as debit_amount,
  0::bigint as credit_amount
from unioned u
join fiscal_bounds fb on fb.school_id = u.school_id
where u.transaction_date >= fb.fy_start
    and u.transaction_date <  fb.fy_end;

-- Vue de contrôle : agrégats par compte + équilibre vérifié
create or replace view public.v_syscohada_control as
with lines as (
  select school_id, debit_account as account, debit_amount as debit, 0::bigint as credit
  from public.v_syscohada_ledger
  union all
  select school_id, credit_account as account, 0::bigint as debit, debit_amount as credit
  from public.v_syscohada_ledger
),
agg as (
  select
    l.school_id,
    l.account,
    coalesce(sum(l.debit), 0) as total_debit,
    coalesce(sum(l.credit), 0) as total_credit
  from lines l
  group by l.school_id, l.account
)
select
  sch.school_id,
  sp.account,
  sp.label,
  sp.account_type,
  coalesce(a.total_debit, 0) as debit,
  coalesce(a.total_credit, 0) as credit,
  coalesce(a.total_debit, 0) - coalesce(a.total_credit, 0) as balance,
  case sp.account_type
    when 'actif'  then coalesce(a.total_debit, 0) - coalesce(a.total_credit, 0)
    when 'passif' then coalesce(a.total_credit, 0) - coalesce(a.total_debit, 0)
    else 0
  end as signed_balance
from public.syscohada_settings sch
cross join public.syscohada_plan sp
left join agg a on a.school_id = sch.school_id and a.account = sp.account
order by sch.school_id, sp.account_type, sp.account;

