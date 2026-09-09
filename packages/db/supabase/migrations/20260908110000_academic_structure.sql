-- ============================================================================
-- 00003 — Structure académique (Phase 2)
-- academic_years, grade_levels, classes, subjects, class_subject_assignments
-- ============================================================================

-- -------------------------------------------------------- années académiques --
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  status public.academic_year_status not null default 'planifiee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, label)
);

drop trigger if exists trg_academic_years_updated_at on public.academic_years;
create trigger trg_academic_years_updated_at before update on public.academic_years
for each row execute function public.touch_updated_at();

create index if not exists idx_academic_years_school on public.academic_years (school_id);

-- -------------------------------------------------------- niveaux (grade_levels) --
create table if not exists public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  level int not null,
  cycle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, name)
);

drop trigger if exists trg_grade_levels_updated_at on public.grade_levels;
create trigger trg_grade_levels_updated_at before update on public.grade_levels
for each row execute function public.touch_updated_at();

create index if not exists idx_grade_levels_school on public.grade_levels (school_id);

-- -------------------------------------------------------- classes --
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  name text not null,
  capacity int,
  head_teacher_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, name)
);

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at before update on public.classes
for each row execute function public.touch_updated_at();

create index if not exists idx_classes_school on public.classes (school_id);
create index if not exists idx_classes_grade on public.classes (grade_level_id);

-- -------------------------------------------------------- matières --
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  coefficient numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, name)
);

drop trigger if exists trg_subjects_updated_at on public.subjects;
create trigger trg_subjects_updated_at before update on public.subjects
for each row execute function public.touch_updated_at();

create index if not exists idx_subjects_school on public.subjects (school_id);

-- ------------------------------------------ assignation classe × matière -----
create table if not exists public.class_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid references public.users(id),
  coefficient numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, class_id, subject_id)
);

drop trigger if exists trg_class_subject_assignments_updated_at on public.class_subject_assignments;
create trigger trg_class_subject_assignments_updated_at before update on public.class_subject_assignments
for each row execute function public.touch_updated_at();

create index if not exists idx_csa_school on public.class_subject_assignments (school_id);
create index if not exists idx_csa_class on public.class_subject_assignments (class_id);
create index if not exists idx_csa_subject on public.class_subject_assignments (subject_id);

-- ===================================================== RLS ==================
alter table public.academic_years enable row level security;
alter table public.grade_levels enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subject_assignments enable row level security;

drop policy if exists academic_years_member_read on public.academic_years;
create policy academic_years_member_read on public.academic_years for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists academic_years_direction_write on public.academic_years;
create policy academic_years_direction_write on public.academic_years for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists grade_levels_member_read on public.grade_levels;
create policy grade_levels_member_read on public.grade_levels for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists grade_levels_direction_write on public.grade_levels;
create policy grade_levels_direction_write on public.grade_levels for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists classes_member_read on public.classes;
create policy classes_member_read on public.classes for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists classes_direction_write on public.classes;
create policy classes_direction_write on public.classes for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists subjects_member_read on public.subjects;
create policy subjects_member_read on public.subjects for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists subjects_direction_write on public.subjects;
create policy subjects_direction_write on public.subjects for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists csa_member_read on public.class_subject_assignments;
create policy csa_member_read on public.class_subject_assignments for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists csa_direction_write on public.class_subject_assignments;
create policy csa_direction_write on public.class_subject_assignments for all
  using (has_school_role(school_id, array['direction','super_admin']));
