-- ============================================================================
-- 00014 — Onboarding flag on schools (Phase 1 follow-up)
-- Marks an establishment as fully configured via the first-connection wizard.
--
-- A newly created school (via /register-school) starts with
-- is_setup_complete = false. Its founder (role "direction") MUST complete the
-- onboarding wizard before reaching the dashboard. The flag is consumed by the
-- dashboard layout to surface the OnboardingWizard modal on first connection.
--
-- RLS coverage (no new policies required):
--   • is_setup_complete is readable by school members  → policy schools_member_read
--   • is_setup_complete is editable by direction      → policy schools_direction_update
-- ============================================================================

alter table public.schools
  add column if not exists is_setup_complete boolean not null default false;

-- A school that already has an academic year configured is considered set up,
-- so existing/demo tenants are not forced through the wizard.
update public.schools
  set is_setup_complete = true
  where id in (select distinct school_id from public.academic_years)
    and (is_setup_complete is distinct from true);

comment on column public.schools.is_setup_complete is
  'true once the founder has completed the first-connection onboarding wizard';
