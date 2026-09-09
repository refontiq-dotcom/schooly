-- ============================================================================
-- 00008 — Vie scolaire & Accès QR (Phase 7)
-- student_qr_codes (badges QR pour accès), door_entries (journal d'accès),
-- detentions (retenues), dropout_alerts (détection élève entré mais absent)
-- ============================================================================

create table if not exists public.student_qr_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  qr_code text not null,
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, enrollment_id)
);

drop trigger if exists trg_student_qr_codes_updated_at on public.student_qr_codes;
create trigger trg_student_qr_codes_updated_at before update on public.student_qr_codes
for each row execute function public.touch_updated_at();

create index if not exists idx_student_qr_school on public.student_qr_codes (school_id);
create index if not exists idx_student_qr_enrollment on public.student_qr_codes (enrollment_id);
create index if not exists idx_student_qr_code on public.student_qr_codes (qr_code);

-- journal d'accès au portail
create table if not exists public.door_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  qr_code_id uuid not null references public.student_qr_codes(id) on delete cascade,
  event_type text not null check (event_type in ('entry', 'exit')),
  scanned_at timestamptz not null default now(),
  scanned_by uuid references public.users(id),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_door_entries_updated_at on public.door_entries;
create trigger trg_door_entries_updated_at before update on public.door_entries
for each row execute function public.touch_updated_at();

create index if not exists idx_door_entries_school on public.door_entries (school_id);
create index if not exists idx_door_entries_enrollment on public.door_entries (enrollment_id);
create index if not exists idx_door_entries_scanned_at on public.door_entries (scanned_at);
create index if not exists idx_door_entries_event_type on public.door_entries (event_type);

-- retenues
create table if not exists public.detentions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  reason text not null,
  scheduled_date date not null,
  scheduled_time time not null,
  duration_minutes int not null default 60 check (duration_minutes > 0),
  assigned_by uuid references public.users(id),
  served boolean not null default false,
  served_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, enrollment_id, scheduled_date, scheduled_time)
);

drop trigger if exists trg_detentions_updated_at on public.detentions;
create trigger trg_detentions_updated_at before update on public.detentions
for each row execute function public.touch_updated_at();

create index if not exists idx_detentions_school on public.detentions (school_id);
create index if not exists idx_detentions_enrollment on public.detentions (enrollment_id);
create index if not exists idx_detentions_scheduled on public.detentions (scheduled_date);
create index if not exists idx_detentions_served on public.detentions (served);

-- alertes décrochage
create table if not exists public.dropout_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  course_session_id uuid references public.course_sessions(id) on delete cascade,
  door_entry_id uuid references public.door_entries(id) on delete cascade,
  alert_type text not null check (alert_type in ('entered_but_absent', 'absent_but_not_left', 'late_entry')),
  status text not null default 'pending' check (status in ('pending', 'investigated', 'false_alarm', 'resolved')),
  detected_at timestamptz not null default now(),
  investigated_by uuid references public.users(id),
  investigated_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_dropout_alerts_updated_at on public.dropout_alerts;
create trigger trg_dropout_alerts_updated_at before update on public.dropout_alerts
for each row execute function public.touch_updated_at();

create index if not exists idx_dropout_alerts_school on public.dropout_alerts (school_id);
create index if not exists idx_dropout_alerts_enrollment on public.dropout_alerts (enrollment_id);
create index if not exists idx_dropout_alerts_status on public.dropout_alerts (status);
create index if not exists idx_dropout_alerts_detected_at on public.dropout_alerts (detected_at);

-- RLS
alter table public.student_qr_codes enable row level security;
alter table public.door_entries enable row level security;
alter table public.detentions enable row level security;
alter table public.dropout_alerts enable row level security;

-- student_qr_codes
drop policy if exists student_qr_codes_member_read on public.student_qr_codes;
create policy student_qr_codes_member_read on public.student_qr_codes for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or exists (
      select 1 from public.enrollments e
      where e.id = student_qr_codes.enrollment_id
        and e.school_id = (select school_id from public.user_school_roles where user_id = auth.uid() and is_active limit 1)
    )
  );

drop policy if exists student_qr_codes_write on public.student_qr_codes;
create policy student_qr_codes_write on public.student_qr_codes for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));

-- door_entries
drop policy if exists door_entries_surveillance_read on public.door_entries;
create policy door_entries_surveillance_read on public.door_entries for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or has_school_role(school_id, array['surveillance'])
    or enrollment_id in (
      select e.id from public.enrollments e
      where e.school_id = (select school_id from public.user_school_roles where user_id = auth.uid() and is_active limit 1)
    )
  );

drop policy if exists door_entries_write on public.door_entries;
create policy door_entries_write on public.door_entries for all
  using (is_super_admin() or has_school_role(school_id, array['surveillance','direction','super_admin']));

-- detentions
drop policy if exists detentions_member_read on public.detentions;
create policy detentions_member_read on public.detentions for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or enrollment_id in (
      select e.id from public.enrollments e
      where e.school_id = (select school_id from public.user_school_roles where user_id = auth.uid() and is_active limit 1)
    )
  );

-- dropout_alerts
drop policy if exists dropout_alerts_member_read on public.dropout_alerts;
create policy dropout_alerts_member_read on public.dropout_alerts for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists dropout_alerts_write on public.dropout_alerts;
create policy dropout_alerts_write on public.dropout_alerts for all
  using (is_super_admin() or has_school_role(school_id, array['direction','surveillance','super_admin']));

-- dropout_alerts
drop policy if exists dropout_alerts_member_read on public.dropout_alerts;
create policy dropout_alerts_member_read on public.dropout_alerts for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists dropout_alerts_write on public.dropout_alerts;
create policy dropout_alerts_write on public.dropout_alerts for all
  using (is_super_admin() or has_school_role(school_id, array['direction','surveillance','super_admin']));
