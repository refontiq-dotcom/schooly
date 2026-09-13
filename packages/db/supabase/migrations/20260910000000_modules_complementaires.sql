-- ============================================================================
-- 00008 — Modules Complémentaires (Phase 9)
-- Transport, Cantine, Internat
-- ============================================================================

-- ==========================================
-- 1. MODULE TRANSPORT
-- ==========================================

create table if not exists public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  capacity integer check (capacity > 0),
  monthly_fee_cfa bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_bus_routes_updated_at on public.bus_routes;
create trigger trg_bus_routes_updated_at before update on public.bus_routes
for each row execute function public.touch_updated_at();

create index if not exists idx_bus_routes_school on public.bus_routes (school_id);

create table if not exists public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id) on delete cascade,
  name text not null,
  pickup_time time,
  dropoff_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_bus_stops_updated_at on public.bus_stops;
create trigger trg_bus_stops_updated_at before update on public.bus_stops
for each row execute function public.touch_updated_at();

create index if not exists idx_bus_stops_route on public.bus_stops (route_id);

create table if not exists public.transport_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id) on delete restrict,
  stop_id uuid references public.bus_stops(id) on delete set null,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, enrollment_id)
);

drop trigger if exists trg_transport_subs_updated_at on public.transport_subscriptions;
create trigger trg_transport_subs_updated_at before update on public.transport_subscriptions
for each row execute function public.touch_updated_at();

create index if not exists idx_transport_subs_enrollment on public.transport_subscriptions (enrollment_id);

-- ==========================================
-- 2. MODULE CANTINE
-- ==========================================

create table if not exists public.canteen_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  date date not null,
  meal_type text not null default 'lunch' check (meal_type in ('breakfast','lunch','snack')),
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, date, meal_type)
);

drop trigger if exists trg_canteen_menus_updated_at on public.canteen_menus;
create trigger trg_canteen_menus_updated_at before update on public.canteen_menus
for each row execute function public.touch_updated_at();

create index if not exists idx_canteen_menus_school on public.canteen_menus (school_id);

create table if not exists public.canteen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  plan_type text not null check (plan_type in ('daily','weekly','monthly','annual')),
  amount_cfa bigint not null default 0,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, enrollment_id)
);

drop trigger if exists trg_canteen_subs_updated_at on public.canteen_subscriptions;
create trigger trg_canteen_subs_updated_at before update on public.canteen_subscriptions
for each row execute function public.touch_updated_at();

create index if not exists idx_canteen_subs_enrollment on public.canteen_subscriptions (enrollment_id);

create table if not exists public.canteen_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subscription_id uuid not null references public.canteen_subscriptions(id) on delete cascade,
  date date not null default current_date,
  meal_type text not null default 'lunch',
  scanned_at timestamptz not null default now(),
  scanned_by uuid references public.users(id),
  status text not null default 'present' check (status in ('present','absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, date, meal_type)
);

drop trigger if exists trg_canteen_att_updated_at on public.canteen_attendance;
create trigger trg_canteen_att_updated_at before update on public.canteen_attendance
for each row execute function public.touch_updated_at();

create index if not exists idx_canteen_att_sub on public.canteen_attendance (subscription_id);

-- ==========================================
-- 3. MODULE INTERNAT
-- ==========================================

create table if not exists public.dormitories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  gender_restriction text not null check (gender_restriction in ('male','female','mixed')),
  capacity integer not null check (capacity > 0),
  supervisor_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_dormitories_updated_at on public.dormitories;
create trigger trg_dormitories_updated_at before update on public.dormitories
for each row execute function public.touch_updated_at();

create index if not exists idx_dormitories_school on public.dormitories (school_id);

create table if not exists public.dorm_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  dormitory_id uuid not null references public.dormitories(id) on delete cascade,
  room_number text not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dormitory_id, room_number)
);

drop trigger if exists trg_dorm_rooms_updated_at on public.dorm_rooms;
create trigger trg_dorm_rooms_updated_at before update on public.dorm_rooms
for each row execute function public.touch_updated_at();

create index if not exists idx_dorm_rooms_dorm on public.dorm_rooms (dormitory_id);

create table if not exists public.boarding_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  room_id uuid references public.dorm_rooms(id) on delete set null,
  amount_cfa bigint not null default 0,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, enrollment_id)
);

drop trigger if exists trg_boarding_subs_updated_at on public.boarding_subscriptions;
create trigger trg_boarding_subs_updated_at before update on public.boarding_subscriptions
for each row execute function public.touch_updated_at();

create index if not exists idx_boarding_subs_enrollment on public.boarding_subscriptions (enrollment_id);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

alter table public.bus_routes enable row level security;
alter table public.bus_stops enable row level security;
alter table public.transport_subscriptions enable row level security;

alter table public.canteen_menus enable row level security;
alter table public.canteen_subscriptions enable row level security;
alter table public.canteen_attendance enable row level security;

alter table public.dormitories enable row level security;
alter table public.dorm_rooms enable row level security;
alter table public.boarding_subscriptions enable row level security;

-- Lecture pour tous les membres de l'école
create policy bus_routes_member_read on public.bus_routes for select using (is_super_admin() or is_school_member(school_id));
create policy bus_stops_member_read on public.bus_stops for select using (is_super_admin() or is_school_member(school_id));
create policy transport_subs_member_read on public.transport_subscriptions for select using (is_super_admin() or is_school_member(school_id));
create policy canteen_menus_member_read on public.canteen_menus for select using (is_super_admin() or is_school_member(school_id));
create policy canteen_subs_member_read on public.canteen_subscriptions for select using (is_super_admin() or is_school_member(school_id));
create policy canteen_att_member_read on public.canteen_attendance for select using (is_super_admin() or is_school_member(school_id));
create policy dormitories_member_read on public.dormitories for select using (is_super_admin() or is_school_member(school_id));
create policy dorm_rooms_member_read on public.dorm_rooms for select using (is_super_admin() or is_school_member(school_id));
create policy boarding_subs_member_read on public.boarding_subscriptions for select using (is_super_admin() or is_school_member(school_id));

-- Écriture réservée à la direction / super_admin
create policy bus_routes_direction_write on public.bus_routes for all using (is_super_admin() or has_school_role(school_id, array['direction']));
create policy bus_stops_direction_write on public.bus_stops for all using (is_super_admin() or has_school_role(school_id, array['direction']));
create policy transport_subs_direction_write on public.transport_subscriptions for all using (is_super_admin() or has_school_role(school_id, array['direction','compta']));
create policy canteen_menus_direction_write on public.canteen_menus for all using (is_super_admin() or has_school_role(school_id, array['direction']));
create policy canteen_subs_direction_write on public.canteen_subscriptions for all using (is_super_admin() or has_school_role(school_id, array['direction','compta']));
-- surveillance peut scanner à la cantine
create policy canteen_att_staff_write on public.canteen_attendance for all using (is_super_admin() or has_school_role(school_id, array['direction','surveillance']));
create policy dormitories_direction_write on public.dormitories for all using (is_super_admin() or has_school_role(school_id, array['direction']));
create policy dorm_rooms_direction_write on public.dorm_rooms for all using (is_super_admin() or has_school_role(school_id, array['direction']));
create policy boarding_subs_direction_write on public.boarding_subscriptions for all using (is_super_admin() or has_school_role(school_id, array['direction','compta']));
