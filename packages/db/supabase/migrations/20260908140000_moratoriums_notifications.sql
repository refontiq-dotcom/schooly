-- ============================================================================
-- 00006 — Relances & Moratoires (Phase 5)
-- moratoriums, notification_outbox, payment_reminders, family_reliability_scores
-- ============================================================================

-- ------------------------------------------------ demandes de moratoire ---------
create table if not exists public.moratoriums (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  guardian_id uuid not null references public.guardians(id),
  reason text not null,
  requested_amount bigint not null check (requested_amount >= 0),
  approved_amount bigint check (approved_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','completed')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  due_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_moratoriums_updated_at on public.moratoriums;
create trigger trg_moratoriums_updated_at before update on public.moratoriums
for each row execute function public.touch_updated_at();

create index if not exists idx_moratoriums_school on public.moratoriums (school_id);
create index if not exists idx_moratoriums_enrollment on public.moratoriums (enrollment_id);
create index if not exists idx_moratoriums_guardian on public.moratoriums (guardian_id);
create index if not exists idx_moratoriums_status on public.moratoriums (status);

-- ------------------------------------------------ relances de paiement ----------
create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  reminder_type text not null check (reminder_type in ('preventive','formal','warning','access_restriction')),
  channel text not null check (channel in ('push','sms','whatsapp','email')),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_payment_reminders_updated_at on public.payment_reminders;
create trigger trg_payment_reminders_updated_at before update on public.payment_reminders
for each row execute function public.touch_updated_at();

create index if not exists idx_payment_reminders_school on public.payment_reminders (school_id);
create index if not exists idx_payment_reminders_enrollment on public.payment_reminders (enrollment_id);
create index if not exists idx_payment_reminders_type on public.payment_reminders (reminder_type);

-- ------------------------------------ scoring de fiabilité familiale -------------
create table if not exists public.family_reliability_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id),
  score int not null default 100 check (score >= 0 and score <= 100),
  total_moratoriums int not null default 0,
  approved_moratoriums int not null default 0,
  rejected_moratoriums int not null default 0,
  late_payments int not null default 0,
  on_time_payments int not null default 0,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, guardian_id)
);

drop trigger if exists trg_family_reliability_scores_updated_at on public.family_reliability_scores;
create trigger trg_family_reliability_scores_updated_at before update on public.family_reliability_scores
for each row execute function public.touch_updated_at();

create index if not exists idx_family_reliability_scores_school on public.family_reliability_scores (school_id);
create index if not exists idx_family_reliability_scores_guardian on public.family_reliability_scores (guardian_id);

-- ------------------------------------------------ outbox notifications ----------
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  recipient_phone text not null,
  channel text not null check (channel in ('push','sms','whatsapp','email')),
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_notification_outbox_updated_at on public.notification_outbox;
create trigger trg_notification_outbox_updated_at before update on public.notification_outbox
for each row execute function public.touch_updated_at();

create index if not exists idx_notification_outbox_school on public.notification_outbox (school_id);
create index if not exists idx_notification_outbox_status on public.notification_outbox (status);
create index if not exists idx_notification_outbox_scheduled on public.notification_outbox (scheduled_at);

-- ===================================================== RLS ==================
alter table public.moratoriums enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.family_reliability_scores enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists moratoriums_member_read on public.moratoriums;
create policy moratoriums_member_read on public.moratoriums for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists moratoriums_write on public.moratoriums;
create policy moratoriums_write on public.moratoriums for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));

drop policy if exists payment_reminders_member_read on public.payment_reminders;
create policy payment_reminders_member_read on public.payment_reminders for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists payment_reminders_write on public.payment_reminders;
create policy payment_reminders_write on public.payment_reminders for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','caisse','super_admin']));

drop policy if exists family_reliability_scores_member_read on public.family_reliability_scores;
create policy family_reliability_scores_member_read on public.family_reliability_scores for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists family_reliability_scores_write on public.family_reliability_scores;
create policy family_reliability_scores_write on public.family_reliability_scores for all
  using (is_super_admin() or has_school_role(school_id, array['direction','compta','super_admin']));

drop policy if exists notification_outbox_member_read on public.notification_outbox;
create policy notification_outbox_member_read on public.notification_outbox for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists notification_outbox_write on public.notification_outbox;
create policy notification_outbox_write on public.notification_outbox for all
  using (is_super_admin() or has_school_role(school_id, array['direction','compta','secretariat','super_admin']));
