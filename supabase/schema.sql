-- ============================================================================
-- SCHOOLY v2 — Schéma de base Supabase (PostgreSQL)
-- ============================================================================
-- Cœur MVP : établissements, profils+rôles, invitations staff, niveaux avec
-- quotas, sections, élèves, réservations (paiement → place réservée).
-- Toutes les opérations sont idempotentes (IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums --
do $$ begin
  create type school_type as enum ('primaire','college','lycee','professionnel','islamique');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','professeur','secretariat','censeur','parent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('pending_payment','reserved','finalized','cancelled','expired');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------- helper updated_at --
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- --------------------------------------------------------- établissements --
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text not null,
  address text,
  school_type school_type,
  latitude double precision,
  longitude double precision,
  website_url text,
  cover_image_url text,
  reservation_fee_amount numeric(12,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_establishments_updated_at on establishments;
create trigger trg_establishments_updated_at before update on establishments
for each row execute function touch_updated_at();

-- ------------------------------------------------- profils + rôles (guard) --
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role user_role not null default 'parent',
  establishment_id uuid references establishments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tout nouveau compte auth devient un profil parent (les rôles staff passent
-- exclusivement par les invitations / fonctions security definer).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    new.email,
    'parent'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Garde-fou : un client authentifié ne peut pas modifier directement
-- role, establishment_id ou email (uniquement via fonctions security definer).
create or replace function enforce_profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
    new.role is distinct from old.role
    or new.establishment_id is distinct from old.establishment_id
    or new.email is distinct from old.email
  ) then
    raise exception 'Modification directe de role, establishment_id ou email interdite';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on profiles;
create trigger trg_profiles_guard before update on profiles
for each row execute function enforce_profiles_guard();

-- ------------------------------------------------------ invitations staff --
create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  email text not null,
  role user_role not null check (role <> 'parent'),
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (establishment_id, email)
);

-- ------------------------------------------- niveaux (quotas) et sections --
create table if not exists levels (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  capacity int not null default 0 check (capacity >= 0),
  reserved_count int not null default 0 check (reserved_count >= 0),
  created_at timestamptz not null default now(),
  unique (establishment_id, name)
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  capacity int not null default 0 check (capacity >= 0),
  created_at timestamptz not null default now(),
  unique (level_id, name)
);

-- ----------------------------------------------------------------- élèves --
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  section_id uuid references sections(id) on delete set null,
  full_name text not null,
  birthdate date,
  parent_full_name text not null,
  parent_phone text not null,
  parent_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_parent_phone on students (parent_phone);
create index if not exists idx_students_establishment on students (establishment_id);

-- ------------------------------------------------------------ réservations --
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  level_id uuid not null references levels(id) on delete cascade,
  student_full_name text not null,
  student_birthdate date,
  parent_full_name text not null,
  parent_phone text not null,
  parent_email text,
  status reservation_status not null default 'pending_payment',
  payment_reference text,
  amount_paid numeric(12,2),
  reservation_code text unique,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_establishment on reservations (establishment_id);
create index if not exists idx_reservations_status on reservations (status)
  where status = 'pending_payment';

-- Réservation atomique d'une place (anti-survente) : appelée à la confirmation
-- du paiement. Échoue avec exception si le niveau n'a plus de place.
create or replace function confirm_reservation(
  p_reservation_id uuid,
  p_payment_reference text,
  p_amount_paid numeric
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_code text;
begin
  select * into v_reservation from reservations
  where id = p_reservation_id for update;
  if not found then
    raise exception 'Réservation introuvable';
  end if;
  if v_reservation.status <> 'pending_payment' then
    raise exception 'Réservation non en attente de paiement (statut: %)', v_reservation.status;
  end if;

  update levels
  set reserved_count = reserved_count + 1
  where id = v_reservation.level_id and reserved_count < capacity;
  if not found then
    raise exception 'Plus de place disponible pour ce niveau';
  end if;

  v_code := 'SCH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  update reservations
  set status = 'reserved',
      payment_reference = p_payment_reference,
      amount_paid = p_amount_paid,
      reservation_code = v_code
  where id = p_reservation_id;

  return v_code;
end $$;

-- ------------------------------------------------------------------- RLS --
create or replace function is_establishment_member(p_establishment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and establishment_id = p_establishment
  );
$$;

create or replace function is_establishment_admin(p_establishment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and establishment_id = p_establishment and role = 'admin'
  );
$$;

alter table establishments enable row level security;
alter table profiles enable row level security;
alter table staff_invitations enable row level security;
alter table levels enable row level security;
alter table sections enable row level security;
alter table students enable row level security;
alter table reservations enable row level security;

-- establishments : catalogue public en lecture, admin propriétaire en écriture
drop policy if exists establishments_public_read on establishments;
create policy establishments_public_read on establishments for select using (true);

drop policy if exists establishments_admin_update on establishments;
create policy establishments_admin_update on establishments for update
  using (is_establishment_admin(id));

-- profiles : lecture de soi + collègues, mise à jour de soi (colonne garde-fou)
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or (establishment_id is not null and is_establishment_member(establishment_id)));

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid());

-- staff_invitations : gestion par l'admin de l'établissement
drop policy if exists invitations_admin_all on staff_invitations;
create policy invitations_admin_all on staff_invitations for all
  using (is_establishment_admin(establishment_id));

-- levels / sections : disponibilités publiques, écriture par l'admin
drop policy if exists levels_public_read on levels;
create policy levels_public_read on levels for select using (true);
drop policy if exists levels_admin_write on levels;
create policy levels_admin_write on levels for all
  using (is_establishment_admin(establishment_id));

drop policy if exists sections_public_read on sections;
create policy sections_public_read on sections for select using (true);
drop policy if exists sections_admin_write on sections;
create policy sections_admin_write on sections for all
  using (is_establishment_admin(
    (select establishment_id from levels where levels.id = sections.level_id)
  ));

-- students : staff de l'établissement + parent rattaché par téléphone
drop policy if exists students_staff_read on students;
create policy students_staff_read on students for select
  using (is_establishment_member(establishment_id));

drop policy if exists students_parent_read on students;
create policy students_parent_read on students for select
  using (parent_phone = (select phone from profiles where id = auth.uid()));

-- reservations : staff de l'établissement + parent rattaché par téléphone
drop policy if exists reservations_staff_read on reservations;
create policy reservations_staff_read on reservations for select
  using (is_establishment_member(establishment_id));

drop policy if exists reservations_parent_read on reservations;
create policy reservations_parent_read on reservations for select
  using (parent_phone = (select phone from profiles where id = auth.uid()));
