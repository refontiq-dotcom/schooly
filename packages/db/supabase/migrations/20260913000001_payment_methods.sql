-- ============================================================================
-- 00014 — Méthodes de paiement par établissement (configurable)
-- Remplace la méthode fixe "espèces officielles" par une table de méthodes
-- activées par école : espèces, Mobile Money (Wave/Express/MTN), virement bancaire,
-- chèque. Chacune active/inactive + config spécifique (MTN/Orange/Wave, IBAN, etc.).
-- Idempotent : IF NOT EXISTS + DROP TRIGGER / POLICY IF EXISTS.
-- Scope : une ligne par école. RLS scopée + grants service_role.
-- ============================================================================

create table if not exists public.school_payment_methods (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  type          text not null check (type in ('esperes','mobile_money','virement_bancaire','cheque')),
  actif         boolean not null default true,
  -- Mobile Money : opérateur + préfixe
  mobile_money_type text check (mobile_money_type in ('wave','express','mtn','orange','moov','autre') or mobile_money_type is null),
  mobile_money_prefix text check (length(mobile_money_prefix) <= 5 or mobile_money_prefix is null),
  -- Virement bancaire : IBAN + tenant
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  -- Chèque : verbose
  cheque_details text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (school_id, type)
);

create index if not exists idx_school_payment_methods_school
  on public.school_payment_methods (school_id);

drop trigger if exists trg_school_payment_methods_updated_at on public.school_payment_methods;
create trigger trg_school_payment_methods_updated_at
  before update on public.school_payment_methods
  for each row execute function public.touch_updated_at();

alter table public.school_payment_methods enable row level security;

drop policy if exists school_payment_methods_read on public.school_payment_methods;
create policy school_payment_methods_read on public.school_payment_methods for select
  using (deleted_at is null and (is_super_admin() or is_school_member(school_id)));

drop policy if exists school_payment_methods_write on public.school_payment_methods;
create policy school_payment_methods_write on public.school_payment_methods for insert
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists school_payment_methods_update on public.school_payment_methods;
create policy school_payment_methods_update on public.school_payment_methods for update
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']))
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

drop policy if exists school_payment_methods_delete on public.school_payment_methods;
create policy school_payment_methods_delete on public.school_payment_methods for delete
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

grant all on public.school_payment_methods to service_role;

-- ── Seed : méthodes de paiement par défaut (espèces + MM actifs) ──
-- Chaque école se retrouve avec espèces et MM activés dès l'onboarding.

insert into public.school_payment_methods (school_id, type, actif, mobile_money_type, mobile_money_prefix)
  select id, 'esperes', true, null, null from public.schools
  where not exists (select 1 from public.school_payment_methods m where m.school_id = schools.id and m.type = 'esperes')
  on conflict (school_id, type) do nothing;

insert into public.school_payment_methods (school_id, type, actif, mobile_money_type, mobile_money_prefix)
  select id, 'mobile_money', true, 'wave', null from public.schools
  where not exists (select 1 from public.school_payment_methods m where m.school_id = schools.id and m.type = 'mobile_money')
  on conflict (school_id, type) do nothing;
