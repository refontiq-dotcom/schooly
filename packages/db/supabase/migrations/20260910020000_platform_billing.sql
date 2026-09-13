-- ============================================================================
-- 00010 — Facturation SaaS Platform (Phase 11 compléments)
-- platform_fee_ledger : 1000 FCFA / inscription confirmée (mode événementiel)
-- Conforme à refontiq-architecture-ecosysteme.md §6.2 et CdC §14
-- Structure conçue pour être migrée vers @refontiq/billing sans changement.
-- ============================================================================

-- ─── Table principale du ledger événementiel ─────────────────────────────────

create table if not exists public.platform_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  -- Montant en BIGINT (FCFA sans sous-unité) — paramétrable par école via school_features
  amount bigint not null default 1000 check (amount >= 0),
  status text not null default 'due'
    check (status in ('due', 'collected', 'settled')),
  academic_year_id uuid references public.academic_years(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un seul enregistrement par inscription (idempotence)
  unique (enrollment_id)
);

drop trigger if exists trg_platform_fee_ledger_updated_at on public.platform_fee_ledger;
create trigger trg_platform_fee_ledger_updated_at before update on public.platform_fee_ledger
  for each row execute function public.touch_updated_at();

create index if not exists idx_platform_fee_ledger_school on public.platform_fee_ledger (school_id);
create index if not exists idx_platform_fee_ledger_status on public.platform_fee_ledger (status);
create index if not exists idx_platform_fee_ledger_year on public.platform_fee_ledger (academic_year_id);

-- ─── Agrégation trimestrielle pour reporting/audit ───────────────────────────

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  period_label text not null,           -- ex. "T1 2026-2027"
  period_start date not null,
  period_end date not null,
  total_students int not null default 0,
  total_due bigint not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, period_label)
);

drop trigger if exists trg_platform_invoices_updated_at on public.platform_invoices;
create trigger trg_platform_invoices_updated_at before update on public.platform_invoices
  for each row execute function public.touch_updated_at();

create index if not exists idx_platform_invoices_school on public.platform_invoices (school_id);
create index if not exists idx_platform_invoices_status on public.platform_invoices (status);

-- ─── Trigger : inscription confirmée → entrée automatique dans le ledger ──────

create or replace function public.handle_enrollment_confirmed()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Déclenche uniquement lors du passage à 'confirmed' (pas à chaque update)
  if new.status = 'confirmed' and (old.status is null or old.status <> 'confirmed') then
    insert into public.platform_fee_ledger (
      enrollment_id,
      school_id,
      academic_year_id,
      amount,
      status
    ) values (
      new.id,
      new.school_id,
      new.academic_year_id,
      1000, -- 1000 FCFA — montant de base, configurable à terme via school_features
      'due'
    )
    on conflict (enrollment_id) do nothing; -- idempotence : ne crée pas de doublon
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enrollment_confirmed_fee on public.enrollments;
create trigger trg_enrollment_confirmed_fee
  after insert or update of status on public.enrollments
  for each row execute function public.handle_enrollment_confirmed();

-- ─── Étendre le canal Telegram dans notification_outbox ──────────────────────
-- (H3 : ajout du canal telegram à l'enum existant)

alter table public.notification_outbox
  drop constraint if exists notification_outbox_channel_check;

alter table public.notification_outbox
  add constraint notification_outbox_channel_check
  check (channel in ('push', 'sms', 'whatsapp', 'email', 'telegram'));

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.platform_fee_ledger enable row level security;
alter table public.platform_invoices enable row level security;

-- Lecture : super_admin seulement (données de facturation éditeur)
drop policy if exists platform_fee_ledger_super_admin on public.platform_fee_ledger;
create policy platform_fee_ledger_super_admin on public.platform_fee_ledger for all
  using (is_super_admin());

drop policy if exists platform_invoices_super_admin on public.platform_invoices;
create policy platform_invoices_super_admin on public.platform_invoices for all
  using (is_super_admin());

-- ─── Variables d'environnement attendues (commentaire de référence) ───────────
-- TELEGRAM_BOT_TOKEN=<token-du-bot>
-- TELEGRAM_CHAT_ID=<id-du-chat-super-admin>
-- Ces variables permettent au helper src/lib/telegram.ts d'envoyer des alertes.
