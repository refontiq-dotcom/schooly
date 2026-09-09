-- ============================================================================
-- 00005 — Finance & Caisse (Phase 4)
-- fee_schedules, payments, receipts, cash_sessions, accounting_exports
-- Règles : montants en BIGINT (FCFA sans sous-unité), RLS stricte, audit trail.
-- ============================================================================

-- ---------------------------------------------------- sessions de caisse ---------
-- Créé AVANT payments car payments référence cash_sessions
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  opened_by uuid not null references public.users(id),
  closed_by uuid references public.users(id),
  opening_amount bigint not null default 0 check (opening_amount >= 0),
  closing_amount bigint,
  expected_amount bigint,
  difference bigint,
  status text not null default 'open' check (status in ('open','closed','reconciled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_cash_sessions_updated_at on public.cash_sessions;
create trigger trg_cash_sessions_updated_at before update on public.cash_sessions
for each row execute function public.touch_updated_at();

create index if not exists idx_cash_sessions_school on public.cash_sessions (school_id);
create index if not exists idx_cash_sessions_status on public.cash_sessions (status);

-- ----------------------------------------------------- grille tarifaire ----------
create table if not exists public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_level_id uuid references public.grade_levels(id) on delete restrict,
  financial_profile_id uuid references public.financial_profiles(id) on delete restrict,
  amount bigint not null check (amount >= 0),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, grade_level_id, financial_profile_id, academic_year_id)
);

drop trigger if exists trg_fee_schedules_updated_at on public.fee_schedules;
create trigger trg_fee_schedules_updated_at before update on public.fee_schedules
for each row execute function public.touch_updated_at();

create index if not exists idx_fee_schedules_school on public.fee_schedules (school_id);
create index if not exists idx_fee_schedules_year on public.fee_schedules (academic_year_id);

-- ------------------------------------------------------ encaissements -------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  amount bigint not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','mobile_money','check','transfer')),
  reference text,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  received_by uuid references public.users(id),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments
for each row execute function public.touch_updated_at();

create index if not exists idx_payments_school on public.payments (school_id);
create index if not exists idx_payments_enrollment on public.payments (enrollment_id);
create index if not exists idx_payments_session on public.payments (cash_session_id);

-- ------------------------------------------------------- reçus -------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  receipt_number text not null unique,
  verification_code text not null unique,
  qr_code_data text not null,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_receipts_updated_at on public.receipts;
create trigger trg_receipts_updated_at before update on public.receipts
for each row execute function public.touch_updated_at();

create index if not exists idx_receipts_school on public.receipts (school_id);
create index if not exists idx_receipts_payment on public.receipts (payment_id);
create index if not exists idx_receipts_verification on public.receipts (verification_code);

-- -------------------------------------------------- exports comptables -----------
create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  export_type text not null check (export_type in ('syscohada_synthetic','syscohada_analytic','sage','csv')),
  period_start date not null,
  period_end date not null,
  file_url text,
  generated_by uuid references public.users(id),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_accounting_exports_updated_at on public.accounting_exports;
create trigger trg_accounting_exports_updated_at before update on public.accounting_exports
for each row execute function public.touch_updated_at();

create index if not exists idx_accounting_exports_school on public.accounting_exports (school_id);
create index if not exists idx_accounting_exports_year on public.accounting_exports (academic_year_id);

-- ===================================================== RLS ==================
alter table public.fee_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.accounting_exports enable row level security;

drop policy if exists fee_schedules_member_read on public.fee_schedules;
create policy fee_schedules_member_read on public.fee_schedules for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists fee_schedules_direction_write on public.fee_schedules;
create policy fee_schedules_direction_write on public.fee_schedules for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists payments_member_read on public.payments;
create policy payments_member_read on public.payments for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists payments_caisse_write on public.payments;
create policy payments_caisse_write on public.payments for all
  using (is_super_admin() or has_school_role(school_id, array['caisse','direction','compta','super_admin']));

drop policy if exists receipts_member_read on public.receipts;
create policy receipts_member_read on public.receipts for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists receipts_caisse_write on public.receipts;
create policy receipts_caisse_write on public.receipts for all
  using (is_super_admin() or has_school_role(school_id, array['caisse','direction','compta','super_admin']));

drop policy if exists cash_sessions_member_read on public.cash_sessions;
create policy cash_sessions_member_read on public.cash_sessions for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists cash_sessions_caisse_write on public.cash_sessions;
create policy cash_sessions_caisse_write on public.cash_sessions for all
  using (is_super_admin() or has_school_role(school_id, array['caisse','direction','compta','super_admin']));

drop policy if exists accounting_exports_member_read on public.accounting_exports;
create policy accounting_exports_member_read on public.accounting_exports for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists accounting_exports_compta_write on public.accounting_exports;
create policy accounting_exports_compta_write on public.accounting_exports for all
  using (is_super_admin() or has_school_role(school_id, array['compta','direction','super_admin']));
