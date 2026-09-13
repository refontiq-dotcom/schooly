-- ============================================================================
-- 00009 — Bascule d'Année Académique (Phase 11)
-- Tables : year_rollover_logs, enrollment_decisions (audit + traçabilité)
-- ============================================================================

-- Enregistre chaque opération de bascule pour l'audit
create table if not exists public.year_rollover_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  old_year_id uuid not null references public.academic_years(id) on delete restrict,
  new_year_id uuid not null references public.academic_years(id) on delete restrict,
  initiated_by uuid not null references public.users(id),
  initiated_at timestamptz not null default now(),
  -- Compteurs de l'opération
  students_promoted integer not null default 0,
  students_repeated integer not null default 0,
  students_excluded integer not null default 0,
  students_pending integer not null default 0,
  -- Statut de la bascule
  status text not null default 'pending' check (status in ('pending','in_progress','completed','failed')),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.year_rollover_logs enable row level security;
create policy rollover_logs_direction_read on public.year_rollover_logs for select
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));
create policy rollover_logs_direction_write on public.year_rollover_logs for insert
  with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));
