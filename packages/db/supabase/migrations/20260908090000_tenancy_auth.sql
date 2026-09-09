-- ============================================================================
-- 00001 — Domaine A : Tenancy & Auth
-- schools (tenant racine), users, roles (catalogue configurable),
-- user_school_roles, school_features (feature flags par établissement).
-- Conventions : audit (created_at/updated_at), soft-delete (deleted_at),
-- isolation stricte par RLS (jamais uniquement applicative).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums --
do $$ begin
  create type public.school_type as enum
    ('primaire','college','lycee','professionnel','islamique','superieur');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.academic_year_status as enum ('planifiee','en_cours','cloturee');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------- helper updated_at ---- --
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------- catalogue des rôles (configurable) --
create table if not exists public.roles (
  code text primary key,
  label text not null
);

insert into public.roles (code, label) values
  ('super_admin', 'Super Admin (éditeur)'),
  ('direction', 'Direction'),
  ('secretariat', 'Secrétariat / Admissions'),
  ('compta', 'Chef Comptable'),
  ('caisse', 'Caissier'),
  ('professeur', 'Enseignant'),
  ('surveillance', 'Surveillance générale'),
  ('parent', 'Parent / Tuteur'),
  ('eleve', 'Élève')
on conflict (code) do update set label = excluded.label;

-- -------------------------------------------------------- tenant racine ----
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  school_type public.school_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_schools_updated_at on public.schools;
create trigger trg_schools_updated_at before update on public.schools
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ users --
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  phone text unique,
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_users_phone on public.users (phone);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
for each row execute function public.touch_updated_at();

-- Tout nouveau compte auth crée sa fiche users (staff ou parent).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Utilisateur'),
    nullif(new.email, ''),
    nullif(new.phone, '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = coalesce(public.users.email, excluded.email),
        phone = coalesce(public.users.phone, excluded.phone);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------- rattachement rôle × école -----
create table if not exists public.user_school_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role_code text not null references public.roles(code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, school_id, role_code)
);

create index if not exists idx_usr_user on public.user_school_roles (user_id);
create index if not exists idx_usr_school on public.user_school_roles (school_id);

-- Les attributions de rôles passent exclusivement par le service role
-- (fonctions security definer / back-office super admin) : aucune policy
-- d'écriture n'est accordée aux clients.

-- ------------------------------------------------- feature flags école -----
create table if not exists public.school_features (
  school_id uuid not null references public.schools(id) on delete cascade,
  feature text not null,
  enabled boolean not null default false,
  primary key (school_id, feature)
);

-- ===================================================== helpers RLS ==========
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_school_roles usr
    where usr.user_id = auth.uid() and usr.is_active and usr.role_code = 'super_admin'
  );
$$;

create or replace function public.is_school_member(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_school_roles
    where user_id = auth.uid() and school_id = p_school and is_active
  );
$$;

create or replace function public.has_school_role(p_school uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_school_roles
    where user_id = auth.uid() and school_id = p_school
      and is_active and role_code = any (p_roles)
  );
$$;

-- ===================================================== RLS ==================
alter table public.roles enable row level security;
alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.user_school_roles enable row level security;
alter table public.school_features enable row level security;

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select using (auth.uid() is not null);

drop policy if exists schools_member_read on public.schools;
create policy schools_member_read on public.schools for select
  using (deleted_at is null and (is_super_admin() or is_school_member(id)));

drop policy if exists schools_direction_update on public.schools;
create policy schools_direction_update on public.schools for update
  using (has_school_role(id, array['direction']));

drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (
    id = auth.uid()
    or is_super_admin()
    or exists (
      select 1
      from public.user_school_roles mine
      join public.user_school_roles theirs on theirs.school_id = mine.school_id
      where mine.user_id = auth.uid()
        and theirs.user_id = public.users.id
        and mine.is_active and theirs.is_active
    )
  );

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update using (id = auth.uid());

drop policy if exists usr_read on public.user_school_roles;
create policy usr_read on public.user_school_roles for select
  using (user_id = auth.uid() or is_super_admin() or is_school_member(school_id));

drop policy if exists features_member_read on public.school_features;
create policy features_member_read on public.school_features for select
  using (is_super_admin() or is_school_member(school_id));

drop policy if exists features_direction_write on public.school_features;
create policy features_direction_write on public.school_features for all
  using (has_school_role(school_id, array['direction']));
