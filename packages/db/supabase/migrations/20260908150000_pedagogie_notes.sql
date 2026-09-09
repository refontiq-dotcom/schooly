-- ============================================================================
-- 00007 — Pédagogie & Évaluation (Phase 6)
-- course_sessions (appels/assiduité), homeworks (cahier de texte),
-- grade_entries (saisie de notes), academic_decisions (conseil de classe),
-- report_cards (bulletins PDF générés)
-- Règles : RLS stricte, au niveau classe/professeur, soft-delete.
-- ============================================================================

-- --------------------------------------------------------- créneaux de cours & appels --
create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.users(id),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, class_id, subject_id, teacher_id, starts_at)
);

drop trigger if exists trg_course_sessions_updated_at on public.course_sessions;
create trigger trg_course_sessions_updated_at before update on public.course_sessions
for each row execute function public.touch_updated_at();

create index if not exists idx_course_sessions_school on public.course_sessions (school_id);
create index if not exists idx_course_sessions_class on public.course_sessions (class_id);
create index if not exists idx_course_sessions_teacher on public.course_sessions (teacher_id);
create index if not exists idx_course_sessions_starts_at on public.course_sessions (starts_at);
create index if not exists idx_course_sessions_year on public.course_sessions (academic_year_id);

-- -------------------------------------------------------------- assiduité (appel) -------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  course_session_id uuid not null references public.course_sessions(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  status text not null check (status in ('present','absent','tardy','excused')),
  remark text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (course_session_id, enrollment_id)
);

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at before update on public.attendance_records
for each row execute function public.touch_updated_at();

create index if not exists idx_attendance_school on public.attendance_records (school_id);
create index if not exists idx_attendance_session on public.attendance_records (course_session_id);
create index if not exists idx_attendance_enrollment on public.attendance_records (enrollment_id);

-- ------------------------------------------------------------- devoirs (cahier de texte) ---
create table if not exists public.homeworks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.users(id),
  title text not null,
  description text,
  due_date date not null,
  supports jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_homeworks_updated_at on public.homeworks;
create trigger trg_homeworks_updated_at before update on public.homeworks
for each row execute function public.touch_updated_at();

create index if not exists idx_homeworks_school on public.homeworks (school_id);
create index if not exists idx_homeworks_class on public.homeworks (class_id);
create index if not exists idx_homeworks_teacher on public.homeworks (teacher_id);
create index if not exists idx_homeworks_due on public.homeworks (due_date);

-- ------------------------------------------------------------ saisie de notes -------------
-- Une note est saisie pour un élève (via enrollment) pour un devoir/Contrôle.
create table if not exists public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  grade_type text not null check (grade_type in ('devoir','controle','interrogation','project','other')),
  label text not null,
  value numeric not null check (value >= 0 and value <= 20),
  max_value numeric not null default 20 check (max_value > 0),
  weight numeric not null default 1 check (weight >= 0),
  comment text,
  session_id uuid references public.course_sessions(id) on delete set null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, enrollment_id, subject_id, academic_year_id, grade_type, label)
);

drop trigger if exists trg_grade_entries_updated_at on public.grade_entries;
create trigger trg_grade_entries_updated_at before update on public.grade_entries
for each row execute function public.touch_updated_at();

create index if not exists idx_grade_entries_school on public.grade_entries (school_id);
create index if not exists idx_grade_entries_enrollment on public.grade_entries (enrollment_id);
create index if not exists idx_grade_entries_subject on public.grade_entries (subject_id);
create index if not exists idx_grade_entries_year on public.grade_entries (academic_year_id);
create index if not exists idx_grade_entries_created_by on public.grade_entries (created_by);

-- ----------------------------------------------------------- décisions de conseil ---------
-- Admis / Redouble / Exclu avec date et observations.
create table if not exists public.academic_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  decision text not null check (decision in ('admitted','repeated','excluded','pending')),
  average numeric,
  observations text,
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, enrollment_id, academic_year_id)
);

drop trigger if exists trg_academic_decisions_updated_at on public.academic_decisions;
create trigger trg_academic_decisions_updated_at before update on public.academic_decisions
for each row execute function public.touch_updated_at();

create index if not exists idx_academic_decisions_school on public.academic_decisions (school_id);
create index if not exists idx_academic_decisions_enrollment on public.academic_decisions (enrollment_id);
create index if not exists idx_academic_decisions_year on public.academic_decisions (academic_year_id);

-- ------------------------------------------------------------ bulletins PDF --------------
-- Stocke les métadonnées du bulletin (le PDF proprement dit est hors base — texte-only).
create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','generated','sent','archived')),
  pdf_url text,
  generated_by uuid references public.users(id),
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, enrollment_id, academic_year_id)
);

drop trigger if exists trg_report_cards_updated_at on public.report_cards;
create trigger trg_report_cards_updated_at before update on public.report_cards
for each row execute function public.touch_updated_at();

create index if not exists idx_report_cards_school on public.report_cards (school_id);
create index if not exists idx_report_cards_enrollment on public.report_cards (enrollment_id);
create index if not exists idx_report_cards_year on public.report_cards (academic_year_id);

-- ================================================ RLS =====================
alter table public.course_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.homeworks enable row level security;
alter table public.grade_entries enable row level security;
alter table public.academic_decisions enable row level security;
alter table public.report_cards enable row level security;

-- course_sessions : prof voit ses cours, direction/super_admin voit tout
drop policy if exists course_sessions_teacher_read on public.course_sessions;
create policy course_sessions_teacher_read on public.course_sessions for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or teacher_id = auth.uid()
  );

drop policy if exists course_sessions_direction_write on public.course_sessions;
create policy course_sessions_direction_write on public.course_sessions for all
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

-- attendance_records : prof voit les appels de ses sessions, direction tout
drop policy if exists attendance_records_teacher_read on public.attendance_records;
create policy attendance_records_teacher_read on public.attendance_records for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or recorded_by = auth.uid()
    or exists (
      select 1 from public.course_sessions cs
      where cs.id = attendance_records.course_session_id
        and cs.teacher_id = auth.uid()
    )
  );

drop policy if exists attendance_records_write on public.attendance_records;
create policy attendance_records_write on public.attendance_records for all
  using (
    is_super_admin()
    or has_school_role(school_id, array['direction','super_admin','surveillance'])
    or recorded_by = auth.uid()
  );

-- homeworks : prof voit/écrit ses devoirs, élèves/parents voient publiés
drop policy if exists homeworks_teacher_read on public.homeworks;
create policy homeworks_teacher_read on public.homeworks for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or teacher_id = auth.uid()
  );

drop policy if exists homeworks_teacher_write on public.homeworks;
create policy homeworks_teacher_write on public.homeworks for all
  using (
    is_super_admin()
    or has_school_role(school_id, array['direction','super_admin','professeur'])
    or teacher_id = auth.uid()
  );

-- grade_entries : prof voit/écrit ses notes, direction tout
drop policy if exists grade_entries_teacher_read on public.grade_entries;
create policy grade_entries_teacher_read on public.grade_entries for select
  using (
    is_super_admin()
    or is_school_member(school_id)
    or created_by = auth.uid()
  );

drop policy if exists grade_entries_write on public.grade_entries;
create policy grade_entries_write on public.grade_entries for all
  using (
    is_super_admin()
    or has_school_role(school_id, array['direction','super_admin','professeur'])
    or created_by = auth.uid()
  );

-- academic_decisions : direction/super_admin gère, tous les membres lisent
drop policy if exists academic_decisions_member_read on public.academic_decisions;
create policy academic_decisions_member_read on public.academic_decisions for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists academic_decisions_direction_write on public.academic_decisions;
create policy academic_decisions_direction_write on public.academic_decisions for all
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));

-- report_cards : direction/super_admin gère, membres lisent
drop policy if exists report_cards_member_read on public.report_cards;
create policy report_cards_member_read on public.report_cards for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists report_cards_direction_write on public.report_cards;
create policy report_cards_direction_write on public.report_cards for all
  using (is_super_admin() or has_school_role(school_id, array['direction','super_admin']));
