-- ============================================================================
-- 20260913100000 - Decisions de fin d'annee (Phase 11, chainon manquant)
-- Table : enrollment_decisions - une decision par inscription et par annee
-- (admitted / repeated / excluded / pending). Le panneau de bascule la lit
-- (preview) et l'ecrit (saisie direction) ; SANS elle, getRolloverPreview
-- echoue et executeRollover traite tout en "pending".
-- Idempotent : IF NOT EXISTS + DROP POLICY IF EXISTS.
-- ============================================================================

create table if not exists public.enrollment_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  decision text not null default 'pending'
    check (decision in ('admitted', 'repeated', 'excluded', 'pending')),
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, academic_year_id)
);

create index if not exists idx_enrollment_decisions_school
  on public.enrollment_decisions (school_id);
create index if not exists idx_enrollment_decisions_year
  on public.enrollment_decisions (academic_year_id);
create index if not exists idx_enrollment_decisions_enrollment
  on public.enrollment_decisions (enrollment_id);

drop trigger if exists trg_enrollment_decisions_updated_at on public.enrollment_decisions;
create trigger trg_enrollment_decisions_updated_at before update on public.enrollment_decisions
for each row execute function public.touch_updated_at();

alter table public.enrollment_decisions enable row level security;

drop policy if exists enrollment_decisions_direction_read on public.enrollment_decisions;
create policy enrollment_decisions_direction_read on public.enrollment_decisions for select
  using (is_super_admin() or has_school_role(school_id, array['direction', 'super_admin']));

drop policy if exists enrollment_decisions_direction_write on public.enrollment_decisions;
create policy enrollment_decisions_direction_write on public.enrollment_decisions for insert
  with check (is_super_admin() or has_school_role(school_id, array['direction', 'super_admin']));

drop policy if exists enrollment_decisions_direction_update on public.enrollment_decisions;
create policy enrollment_decisions_direction_update on public.enrollment_decisions for update
  using (is_super_admin() or has_school_role(school_id, array['direction', 'super_admin']))
  with check (is_super_admin() or has_school_role(school_id, array['direction', 'super_admin']));

grant all on public.enrollment_decisions to service_role;
