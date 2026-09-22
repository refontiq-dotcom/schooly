-- Universal pedagogical assignment model for primary, secondary, technical and higher education.
create table if not exists public.pedagogical_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  scope text not null default 'class' check (scope in ('class','subject','module','course','program','custom')),
  responsibility_type text not null default 'teaching' check (responsibility_type in ('teaching','class_management','coordination','supervision','custom')),
  status text not null default 'active' check (status in ('draft','active','suspended','ended','cancelled')),
  label text,
  starts_at date,
  ends_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pedagogical_assignments_dates_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists idx_pedagogical_assignments_school_year on public.pedagogical_assignments(school_id, academic_year_id) where deleted_at is null;
create index if not exists idx_pedagogical_assignments_class on public.pedagogical_assignments(class_id) where deleted_at is null;
create index if not exists idx_pedagogical_assignments_scope on public.pedagogical_assignments(school_id, academic_year_id, scope) where deleted_at is null;
create index if not exists idx_pedagogical_assignments_metadata on public.pedagogical_assignments using gin(metadata);

create table if not exists public.pedagogical_assignment_members (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.pedagogical_assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher','head_teacher','co_teacher','assistant','coordinator','supervisor','intervenant','custom')),
  is_primary boolean not null default false,
  starts_at date,
  ends_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id),
  constraint pedagogical_assignment_members_dates_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create unique index if not exists uq_pedagogical_assignment_primary_member on public.pedagogical_assignment_members(assignment_id) where is_primary = true;
create index if not exists idx_pedagogical_assignment_members_user on public.pedagogical_assignment_members(user_id);
create index if not exists idx_pedagogical_assignment_members_assignment on public.pedagogical_assignment_members(assignment_id);

create table if not exists public.pedagogical_assignment_units (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.pedagogical_assignments(id) on delete cascade,
  unit_type text not null check (unit_type in ('subject','module','course','ue','activity','custom')),
  subject_id uuid references public.subjects(id) on delete set null,
  label text,
  position integer not null default 0,
  is_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedagogical_assignment_units_target_check check (subject_id is not null or label is not null)
);

create index if not exists idx_pedagogical_assignment_units_assignment on public.pedagogical_assignment_units(assignment_id);
create index if not exists idx_pedagogical_assignment_units_subject on public.pedagogical_assignment_units(subject_id) where subject_id is not null;
create index if not exists idx_pedagogical_assignment_units_metadata on public.pedagogical_assignment_units using gin(metadata);

alter table public.class_subject_assignments add column if not exists pedagogical_assignment_id uuid references public.pedagogical_assignments(id) on delete set null;
create index if not exists idx_class_subject_assignments_pedagogical on public.class_subject_assignments(pedagogical_assignment_id) where pedagogical_assignment_id is not null;

alter table public.school_supply_proposals add column if not exists pedagogical_assignment_id uuid references public.pedagogical_assignments(id) on delete cascade;
create index if not exists idx_school_supply_proposals_pedagogical_assignment on public.school_supply_proposals(pedagogical_assignment_id) where deleted_at is null;

alter table public.pedagogical_assignments enable row level security;
alter table public.pedagogical_assignment_members enable row level security;
alter table public.pedagogical_assignment_units enable row level security;

create or replace function public.set_pedagogical_assignment_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_pedagogical_assignments_updated_at on public.pedagogical_assignments;
create trigger trg_pedagogical_assignments_updated_at before update on public.pedagogical_assignments for each row execute function public.set_pedagogical_assignment_updated_at();
drop trigger if exists trg_pedagogical_assignment_members_updated_at on public.pedagogical_assignment_members;
create trigger trg_pedagogical_assignment_members_updated_at before update on public.pedagogical_assignment_members for each row execute function public.set_pedagogical_assignment_updated_at();
drop trigger if exists trg_pedagogical_assignment_units_updated_at on public.pedagogical_assignment_units;
create trigger trg_pedagogical_assignment_units_updated_at before update on public.pedagogical_assignment_units for each row execute function public.set_pedagogical_assignment_updated_at();

-- Backfill the universal layer from the existing teaching assignments.
insert into public.pedagogical_assignments
  (school_id, academic_year_id, class_id, scope, responsibility_type, status, label, metadata)
select distinct
  a.school_id,
  ay.id,
  a.class_id,
  case when s.school_type = 'primaire' then 'class' else 'subject' end,
  case when s.school_type = 'primaire' then 'class_management' else 'teaching' end,
  'active',
  case when s.school_type = 'primaire' then c.name else coalesce(sub.name, c.name) end,
  jsonb_build_object('source','class_subject_assignments','migration','universal_pedagogical_assignments')
from public.class_subject_assignments a
join public.schools s on s.id=a.school_id
join public.classes c on c.id=a.class_id
join public.academic_years ay on ay.school_id=a.school_id and ay.status='en_cours' and ay.deleted_at is null
left join public.subjects sub on sub.id=a.subject_id
where a.deleted_at is null
  and not exists (
    select 1 from public.pedagogical_assignments p
    where p.school_id=a.school_id and p.academic_year_id=ay.id and p.class_id=a.class_id
      and p.scope = case when s.school_type='primaire' then 'class' else 'subject' end
      and (p.scope <> 'subject' or p.label=coalesce(sub.name,c.name))
      and p.deleted_at is null
  );

-- Link legacy assignments to their universal counterpart.
update public.class_subject_assignments a
set pedagogical_assignment_id=p.id
from public.pedagogical_assignments p
join public.schools s on s.id=p.school_id
join public.academic_years ay on ay.id=p.academic_year_id
where a.school_id=p.school_id
  and a.class_id=p.class_id
  and a.deleted_at is null
  and ay.status='en_cours'
  and (
    (s.school_type='primaire' and p.scope='class')
    or
    (s.school_type<>'primaire' and p.scope='subject'
      and p.label=(select sub.name from public.subjects sub where sub.id=a.subject_id))
  )
  and p.deleted_at is null
  and a.pedagogical_assignment_id is null;

-- Add the primary teacher/member from the class head-teacher field when available.
insert into public.pedagogical_assignment_members
  (assignment_id, user_id, role, is_primary, metadata)
select p.id, c.head_teacher_id, 'head_teacher', true,
       jsonb_build_object('source','classes.head_teacher_id')
from public.pedagogical_assignments p
join public.classes c on c.id=p.class_id
join public.schools s on s.id=p.school_id
where p.scope='class'
  and s.school_type='primaire'
  and c.head_teacher_id is not null
  and p.deleted_at is null
on conflict (assignment_id,user_id) do update
set role=excluded.role, is_primary=excluded.is_primary;

-- Make every current universal assignment visible to the authenticated application role.
grant select, insert, update, delete on public.pedagogical_assignments to authenticated;
grant select, insert, update, delete on public.pedagogical_assignment_members to authenticated;
grant select, insert, update, delete on public.pedagogical_assignment_units to authenticated;