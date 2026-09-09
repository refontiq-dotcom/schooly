-- ============================================================================
-- 00004 — Élèves, Inscriptions & Profils financiers (Phase 3)
-- guardians, students, pre_enrollments, enrollments, financial_profiles
-- ============================================================================

-- -------------------------------------------- profils financiers configurables --
create table if not exists public.financial_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, name)
);

drop trigger if exists trg_financial_profiles_updated_at on public.financial_profiles;
create trigger trg_financial_profiles_updated_at before update on public.financial_profiles
for each row execute function public.touch_updated_at();

create index if not exists idx_financial_profiles_school on public.financial_profiles (school_id);

-- ----------------------------------------------- tuteurs (identité globale) -----
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  full_name text not null,
  email text,
  address text,
  occupation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_guardians_phone on public.guardians (phone);

drop trigger if exists trg_guardians_updated_at on public.guardians;
create trigger trg_guardians_updated_at before update on public.guardians
for each row execute function public.touch_updated_at();

-- -------------------------------------------------------- élèves -----------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  birth_certificate_number text,
  gender text,
  address text,
  photo_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_students_school on public.students (school_id);
create index if not exists idx_students_guardian on public.students (school_id, last_name, first_name);

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students
for each row execute function public.touch_updated_at();

-- ------------------------------------------ pré-inscriptions légères -----------
create table if not exists public.pre_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  grade_level_id uuid references public.grade_levels(id),
  guardian_phone text not null,
  code text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, code)
);

create index if not exists idx_pre_enrollments_school on public.pre_enrollments (school_id);
create index if not exists idx_pre_enrollments_code on public.pre_enrollments (code);

drop trigger if exists trg_pre_enrollments_updated_at on public.pre_enrollments;
create trigger trg_pre_enrollments_updated_at before update on public.pre_enrollments
for each row execute function public.touch_updated_at();

-- ---------------------------------------------- inscriptions complètes ---------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id),
  grade_level_id uuid not null references public.grade_levels(id),
  class_id uuid references public.classes(id),
  academic_year_id uuid not null references public.academic_years(id),
  financial_profile_id uuid references public.financial_profiles(id),
  enrollment_date date not null default now(),
  status text not null default 'active',
  matricule text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, matricule)
);

create index if not exists idx_enrollments_school on public.enrollments (school_id);
create index if not exists idx_enrollments_student on public.enrollments (student_id);
create index if not exists idx_enrollments_guardian on public.enrollments (guardian_id);
create index if not exists idx_enrollments_class on public.enrollments (class_id);
create index if not exists idx_enrollments_year on public.enrollments (academic_year_id);

drop trigger if exists trg_enrollments_updated_at on public.enrollments;
create trigger trg_enrollments_updated_at before update on public.enrollments
for each row execute function public.touch_updated_at();

-- ===================================================== RLS ==================
alter table public.financial_profiles enable row level security;
alter table public.guardians enable row level security;
alter table public.students enable row level security;
alter table public.pre_enrollments enable row level security;
alter table public.enrollments enable row level security;

drop policy if exists financial_profiles_member_read on public.financial_profiles;
create policy financial_profiles_member_read on public.financial_profiles for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists financial_profiles_direction_write on public.financial_profiles;
create policy financial_profiles_direction_write on public.financial_profiles for all
  using (has_school_role(school_id, array['direction','super_admin']));

drop policy if exists guardians_member_read on public.guardians;
create policy guardians_member_read on public.guardians for select
  using (is_super_admin() or exists (
    select 1 from public.enrollments e
    where e.guardian_id = public.guardians.id
      and e.school_id = (select school_id from public.user_school_roles where user_id = auth.uid() and is_active limit 1)
  ));

drop policy if exists guardians_write on public.guardians;
create policy guardians_write on public.guardians for all
  using (is_super_admin() or exists (
    select 1 from public.user_school_roles usr
    where usr.user_id = auth.uid()
      and usr.is_active
      and usr.role_code = any (array['direction','secretariat','super_admin'])
  ));

drop policy if exists students_member_read on public.students;
create policy students_member_read on public.students for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists students_write on public.students;
create policy students_write on public.students for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));

drop policy if exists pre_enrollments_member_read on public.pre_enrollments;
create policy pre_enrollments_member_read on public.pre_enrollments for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists pre_enrollments_write on public.pre_enrollments;
create policy pre_enrollments_write on public.pre_enrollments for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));

drop policy if exists enrollments_member_read on public.enrollments;
create policy enrollments_member_read on public.enrollments for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists enrollments_write on public.enrollments;
create policy enrollments_write on public.enrollments for all
  using (is_super_admin() or has_school_role(school_id, array['direction','secretariat','super_admin']));
