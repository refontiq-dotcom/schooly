-- ============================================================================
-- SCHOOLY — Module Internat (10 tables)
-- ============================================================================

do $$ begin
  create type internat_gender as enum ('garcon', 'fille', 'mixte');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_room_status as enum ('disponible', 'maintenance', 'complet');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_bed_status as enum ('libre', 'occupe', 'maintenance');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_assignment_status as enum ('actif', 'suspendu', 'termine');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_roll_call_type as enum ('matin', 'soir');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_meal_type as enum ('petit_dejeuner', 'dejeuner', 'diner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_incident_severity as enum ('mineur', 'majeur', 'grave');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_incident_category as enum ('discipline', 'sante', 'comportement', 'autre');
exception when duplicate_object then null; end $$;

-- 1. BÂTIMENTS
create table if not exists internat_blocks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  gender internat_gender not null default 'mixte',
  capacity int not null default 0,
  created_at timestamptz not null default now(),
  unique (establishment_id, name)
);

-- 2. CHAMBRES
create table if not exists internat_rooms (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references internat_blocks(id) on delete cascade,
  number text not null,
  bed_count int not null default 2 check (bed_count > 0),
  status internat_room_status not null default 'disponible',
  created_at timestamptz not null default now(),
  unique (block_id, number)
);

-- 3. LITS
create table if not exists internat_beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references internat_rooms(id) on delete cascade,
  bed_number int not null,
  status internat_bed_status not null default 'libre',
  created_at timestamptz not null default now(),
  unique (room_id, bed_number)
);

-- 4. AFFECTATIONS
create table if not exists internat_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  bed_id uuid not null references internat_beds(id) on delete cascade,
  academic_year text not null default '2026-2027',
  start_date date not null default current_date,
  end_date date,
  status internat_assignment_status not null default 'actif',
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, academic_year),
  unique (bed_id, academic_year)
);

-- 5. APPELS (Roll calls)
create table if not exists internat_roll_calls (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references internat_blocks(id) on delete cascade,
  roll_call_date date not null default current_date,
  roll_call_type internat_roll_call_type not null,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (block_id, roll_call_date, roll_call_type)
);

-- 6. DÉTAIL APPEL
create table if not exists internat_roll_items (
  id uuid primary key default gen_random_uuid(),
  roll_call_id uuid not null references internat_roll_calls(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default true,
  note text,
  late_minutes int default 0,
  created_at timestamptz not null default now(),
  unique (roll_call_id, student_id)
);

-- 7. REPAS
create table if not exists internat_meals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  meal_date date not null default current_date,
  meal_type internat_meal_type not null,
  meal_name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (establishment_id, meal_date, meal_type)
);

-- 8. PRÉSENCE REPAS
create table if not exists internat_meal_attendance (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references internat_meals(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  unique (meal_id, student_id)
);

-- 9. INCIDENTS
create table if not exists internat_incidents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  incident_date date not null default current_date,
  severity internat_incident_severity not null default 'mineur',
  category internat_incident_category not null default 'autre',
  title text not null,
  description text,
  reported_by uuid references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);


-- 10. VISITES
create table if not exists internat_visits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  visitor_name text not null,
  visitor_phone text,
  relationship text,
  visit_date date not null default current_date,
  arrive_at timestamptz,
  leave_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 11. SUIVI SANTÉ
create table if not exists internat_health (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  check_date date not null default current_date,
  temperature numeric(4,1),
  weight numeric(5,2),
  symptoms text,
  medication text,
  notes text,
  recorded_by uuid references public.profiles(id),
  parent_notified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- VUES
-- ============================================================================

-- Vue: capacité par bâtiment
create or replace view internat_block_capacity as
select
  b.id as block_id,
  b.establishment_id,
  b.name as block_name,
  b.gender,
  count(bd.id) as total_beds,
  count(bd.id) filter (where bd.status = 'occupe') as occupied_beds,
  count(bd.id) filter (where bd.status = 'libre') as free_beds,
  b.capacity
from internat_blocks b
left join internat_rooms r on r.block_id = b.id
left join internat_beds bd on bd.room_id = r.id
group by b.id, b.establishment_id, b.name, b.gender, b.capacity;

-- Vue: statut des chambres
create or replace view internat_rooms_status_view as
select
  r.id as room_id,
  r.block_id,
  r.number,
  r.bed_count,
  count(bd.id) filter (where bd.status = 'occupe') as occupied,
  count(bd.id) filter (where bd.status = 'libre') as free,
  case
    when count(bd.id) filter (where bd.status = 'occupe') = r.bed_count then 'complet'
    when count(bd.id) filter (where bd.status = 'maintenance') > 0 then 'maintenance'
    else 'disponible'
  end as computed_status
from internat_rooms r
left join internat_beds bd on bd.room_id = r.id
group by r.id, r.block_id, r.number, r.bed_count;

-- ============================================================================
-- RLS
-- ============================================================================

alter table internat_blocks enable row level security;
alter table internat_rooms enable row level security;
alter table internat_beds enable row level security;
alter table internat_assignments enable row level security;
alter table internat_roll_calls enable row level security;
alter table internat_roll_items enable row level security;
alter table internat_meals enable row level security;
alter table internat_meal_attendance enable row level security;
alter table internat_incidents enable row level security;
alter table internat_visits enable row level security;
alter table internat_health enable row level security;

-- Admin: full access to own establishment internat
do $$ begin
  create policy "Admin gère internat" on internat_blocks for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère chambres" on internat_rooms for all
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère lits" on internat_beds for all
    using (room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère affectations" on internat_assignments for all
    using (bed_id in (select id from internat_beds where room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère appels" on internat_roll_calls for all
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère détail appels" on internat_roll_items for all
    using (roll_call_id in (select id from internat_roll_calls where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère repas" on internat_meals for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère présence repas" on internat_meal_attendance for all
    using (meal_id in (select id from internat_meals where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère incidents" on internat_incidents for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère visites" on internat_visits for all
    using (student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère suivi santé" on internat_health for all
    using (student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

-- Staff (secrétariat, censeur): read + limited write
do $$ begin
  create policy "Staff lit internat" on internat_blocks for select
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Staff lit chambres" on internat_rooms for select
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Staff lit lits" on internat_beds for select
    using (room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur')))));
exception when duplicate_object then null; end $$;

-- Grants
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on internat_block_capacity, internat_rooms_status_view to authenticated;
grant execute on all functions in schema public to authenticated;
