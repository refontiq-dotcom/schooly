-- ============================================================================
-- 20260918210000 — Finance Phase 2 : remises, bourses et statut de recouvrement
--
-- 1. fee_discounts : ligne de réduction par inscription (fratrie, bourse,
--    manuelle) — soustraite du total attendu. La réduction est une LIGNE
--    (audit), jamais un montant implicite.
-- 2. enrollments.fee_status : statut de recouvrement maintenu par TRIGGER à
--    chaque écriture de paiement/remise/tranche — requêtes d'impayés O(1)
--    sans lire la vue (attendu/payé/solde dénormalisés).
--
-- Le calcul fratrie/bourse est appliqué côté application (lib/discounts.ts,
-- testé) ; cette migration fournit le stockage et la cohérence.
-- Idempotent. Montants BIGINT en FCFA.
-- ============================================================================

-- ─── 1. Réductions (fratrie / bourse / manuelle) ────────────────────────────
create table if not exists public.fee_discounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  kind text not null check (kind in ('fratrie', 'bourse', 'manuel')),
  label text not null,
  amount bigint not null check (amount > 0),
  reason text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_fee_discounts_updated_at on public.fee_discounts;
create trigger trg_fee_discounts_updated_at before update on public.fee_discounts
  for each row execute function public.touch_updated_at();

create index if not exists idx_fee_discounts_school
  on public.fee_discounts (school_id) where deleted_at is null;
create index if not exists idx_fee_discounts_enrollment
  on public.fee_discounts (enrollment_id) where deleted_at is null;

alter table public.fee_discounts enable row level security;

drop policy if exists fee_discounts_member_read on public.fee_discounts;
create policy fee_discounts_member_read on public.fee_discounts for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists fee_discounts_finance_write on public.fee_discounts;
create policy fee_discounts_finance_write on public.fee_discounts for all
  using (is_super_admin() or has_school_role(school_id, array['direction', 'compta', 'super_admin']));

grant select on public.fee_discounts to authenticated;

-- ─── 2. Statut de recouvrement dénormalisé (mis à jour par trigger) ────────
alter table public.enrollments
  add column if not exists fee_status text not null default 'non_genere'
    check (fee_status in ('non_genere', 'soldé', 'impaye', 'avance', 'moratoire')),
  add column if not exists fee_expected bigint not null default 0,
  add column if not exists fee_paid bigint not null default 0,
  add column if not exists fee_balance bigint not null default 0;

create index if not exists idx_enrollments_fee_status
  on public.enrollments (school_id, fee_status) where deleted_at is null;

create or replace function public.sync_enrollment_fee_status()
returns trigger
language plpgsql
as $$
declare
  v_enrollment uuid;
  v_expected bigint;
  v_paid bigint;
  v_discount bigint;
  v_moratoire boolean;
begin
  v_enrollment := new.enrollment_id;

  select coalesce(sum(sfi.amount), 0)
    into v_expected
    from public.student_fee_items sfi
   where sfi.enrollment_id = v_enrollment
     and sfi.deleted_at is null;

  select coalesce(sum(pay.amount), 0)
    into v_paid
    from public.payments pay
   where pay.enrollment_id = v_enrollment
     and pay.deleted_at is null;

  select coalesce(sum(fd.amount), 0)
    into v_discount
    from public.fee_discounts fd
   where fd.enrollment_id = v_enrollment
     and fd.deleted_at is null;

  select exists (
    select 1 from public.moratoriums m
     where m.enrollment_id = v_enrollment
       and m.status in ('pending', 'approved')
       and m.deleted_at is null
  ) into v_moratoire;

  update public.enrollments e
     set fee_expected = greatest(0, v_expected - v_discount),
         fee_paid     = v_paid,
         fee_balance  = greatest(0, v_expected - v_discount) - v_paid,
         fee_status   = case
           when v_expected = 0 then 'non_genere'
           when v_moratoire then 'moratoire'
           when v_expected - v_discount - v_paid > 0 then 'impaye'
           when v_expected - v_discount - v_paid < 0 then 'avance'
           else 'soldé'
         end
   where e.id = v_enrollment;

  return new;
end;
$$;

comment on function public.sync_enrollment_fee_status() is
  'Recalcule attendu/payé/solde/statut de l''inscription après toute écriture sur tranches, paiements ou remises. Statut : non_genere / soldé / impaye / avance / moratoire.';

drop trigger if exists trg_sync_fee_status_items on public.student_fee_items;
create trigger trg_sync_fee_status_items
  after insert or update or delete on public.student_fee_items
  for each row execute function public.sync_enrollment_fee_status();

drop trigger if exists trg_sync_fee_status_payments on public.payments;
create trigger trg_sync_fee_status_payments
  after insert or update or delete on public.payments
  for each row execute function public.sync_enrollment_fee_status();

drop trigger if exists trg_sync_fee_status_discounts on public.fee_discounts;
create trigger trg_sync_fee_status_discounts
  after insert or update or delete on public.fee_discounts
  for each row execute function public.sync_enrollment_fee_status();

grant execute on function public.sync_enrollment_fee_status() to authenticated;
