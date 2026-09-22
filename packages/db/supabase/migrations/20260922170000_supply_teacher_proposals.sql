-- M4 — collaboration enseignants/direction pour les listes de fournitures
create table if not exists public.school_supply_proposals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  configurations jsonb not null default '{"manuals":[],"stationery":[],"equipment":[]}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','submitted','changes_requested','approved','rejected')),
  revision integer not null default 1,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, academic_year_id, class_id, subject_id, teacher_id)
);

create index if not exists idx_supply_proposals_teacher
  on public.school_supply_proposals(school_id, teacher_id, academic_year_id)
  where deleted_at is null;
create index if not exists idx_supply_proposals_class
  on public.school_supply_proposals(school_id, class_id, academic_year_id)
  where deleted_at is null;
create index if not exists idx_supply_proposals_status
  on public.school_supply_proposals(school_id, status, academic_year_id)
  where deleted_at is null;
create index if not exists idx_supply_proposals_config_gin
  on public.school_supply_proposals using gin(configurations);

drop trigger if exists trg_school_supply_proposals_updated_at on public.school_supply_proposals;
create trigger trg_school_supply_proposals_updated_at
before update on public.school_supply_proposals
for each row execute function public.touch_updated_at();

alter table public.school_supply_proposals enable row level security;

drop policy if exists school_supply_proposals_member_read on public.school_supply_proposals;
create policy school_supply_proposals_member_read
on public.school_supply_proposals for select
using (is_super_admin() or is_school_member(school_id));

drop policy if exists school_supply_proposals_write on public.school_supply_proposals;
create policy school_supply_proposals_write
on public.school_supply_proposals for all
using (is_super_admin() or has_school_role(school_id, array['direction','super_admin','professeur']))
with check (is_super_admin() or has_school_role(school_id, array['direction','super_admin','professeur']));

grant select on public.school_supply_proposals to authenticated;
grant all on public.school_supply_proposals to service_role;
