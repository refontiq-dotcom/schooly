-- ============================================================================
-- MILESTONE 1 — Fiches de Renseignement Intelligente & Fournitures
-- Ajoute les colonnes JSONB optimisées à schools + crée school_supplies
-- Conforme à Zero-Image (aucune photo en BDD — icônes/badge textuels)
-- ============================================================================

-- 1. Colonnes JSONB sur schools (déjà existantes partiellement via migrations)
--    On utilise ADD COLUMN IF NOT EXISTS pour être idempotent

alter table public.schools
  add column if not exists cycles_offered jsonb not null default '{}'::jsonb,
  add column if not exists fees_structure jsonb not null default '{}'::jsonb,
  add column if not exists optional_services jsonb not null default '{}'::jsonb;

-- Index GIN pour recherches JSONB performantes
create index if not exists idx_schools_cycles_offered
  on public.schools using GIN (cycles_offered);
create index if not exists idx_schools_fees_structure
  on public.schools using GIN (fees_structure);
create index if not exists idx_schools_optional_services
  on public.schools using GIN (optional_services);

-- 2. Table school_supplies (nouvelle)
create table if not exists public.school_supplies (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  grade_level_id     uuid references public.grade_levels(id) on delete set null,
  class_name         text not null,
  academic_year_id   uuid references public.academic_years(id) on delete restrict,
  configurations     jsonb not null default '{}'::jsonb,
  status             text not null default 'draft'
                     check (status in ('published', 'draft')),
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- Triggers & indexs
drop trigger if exists trg_school_supplies_updated_at on public.school_supplies;
create trigger trg_school_supplies_updated_at before update on public.school_supplies
  for each row execute function public.touch_updated_at();

create index if not exists idx_school_supplies_school
  on public.school_supplies (school_id) where deleted_at is null;
create index if not exists idx_school_supplies_class
  on public.school_supplies (school_id, class_name) where deleted_at is null;
create index if not exists idx_school_supplies_grade
  on public.school_supplies (grade_level_id) where deleted_at is null;
create index if not exists idx_school_supplies_year
  on public.school_supplies (academic_year_id) where deleted_at is null;
create index if not exists idx_school_supplies_gin_config
  on public.school_supplies using GIN (configurations);
create index if not exists idx_school_supplies_status
  on public.school_supplies (status) where deleted_at is null;

-- Index UNIQUE : (school_id, class_name, academic_year_id) avec gestion du NULL
-- (une classe a une seule fiche de fournitures par année scolaire)
create unique index if not exists idx_school_supplies_unique_per_year
  on public.school_supplies (school_id, class_name, coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

-- 3. RLS pour school_supplies
alter table public.school_supplies enable row level security;

-- Lecture : membres de l'école (direction, secrétariat, prof, etc.) et super_admin
drop policy if exists school_supplies_member_read on public.school_supplies;
create policy school_supplies_member_read on public.school_supplies for select
  using (is_super_admin() or is_school_member(school_id));

-- Écriture : direction + super_admin uniquement
drop policy if exists school_supplies_write on public.school_supplies;
create policy school_supplies_write on public.school_supplies for all
  using (has_school_role(school_id, array['direction', 'super_admin']));

-- Grant pour service_role (usage interne, scripts, sync)
grant all on public.school_supplies to service_role;

-- Lecture pour les membres de l'école (RLS borne les lignes visibles).
-- Les écritures passent par le client service_role (pattern writeContext),
-- cf. 20260918120000_grant_authenticated_tenancy_tables.sql.
grant select on public.school_supplies to authenticated;

-- 4. Fonction utilitaire : fournitures PUBLIÉES d'une école publiée sur Trouvetou
--    security definer (bypass RLS) : usage portail public (anon) et serveur.
--    Garde-fou : l'école doit être publiée sur Trouvetou et non supprimée.
create or replace function public.get_public_school_supplies_for_class(
  p_school_id uuid,
  p_class_name text,
  p_academic_year_id uuid default null
)
returns table (
  configuration jsonb,
  status text,
  published_at timestamptz,
  class_name text,
  grade_level_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select s.configurations, s.status, s.published_at, s.class_name, s.grade_level_id
  from public.school_supplies s
  join public.schools sc on sc.id = s.school_id
  where s.school_id = p_school_id
    and s.class_name = p_class_name
    and s.status = 'published'
    and s.deleted_at is null
    and sc.deleted_at is null
    and sc.published_to_trouvetou is true
    and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
  order by s.updated_at desc
  limit 1;
$$;

revoke all on function public.get_public_school_supplies_for_class(uuid, text, uuid) from public;
grant execute on function public.get_public_school_supplies_for_class(uuid, text, uuid) to anon, authenticated, service_role;

-- 5. Fonction utilitaire : liste des classes publiées (sélecteur de classe portail)
create or replace function public.list_public_school_supply_classes(
  p_school_id uuid,
  p_academic_year_id uuid default null
)
returns table (
  class_name text,
  grade_level_id uuid,
  status text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (s.class_name)
         s.class_name,
         s.grade_level_id,
         s.status,
         s.updated_at
  from public.school_supplies s
  join public.schools sc on sc.id = s.school_id
  where s.school_id = p_school_id
    and s.status = 'published'
    and s.deleted_at is null
    and sc.deleted_at is null
    and sc.published_to_trouvetou is true
    and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
  order by s.class_name, s.updated_at desc;
$$;

revoke all on function public.list_public_school_supply_classes(uuid, uuid) from public;
grant execute on function public.list_public_school_supply_classes(uuid, uuid) to anon, authenticated, service_role;
