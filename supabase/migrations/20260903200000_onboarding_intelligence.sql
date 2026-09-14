-- ============================================================================
-- SCHOOLY v1 — Onboarding (premier établissement) intelligence
-- ============================================================================
-- Ajoute au module Onboarding :
--   * vue état de l'onboarding par établissement (étapes complétées) ;
--   * vue établissements incomplets (sans élèves / profs / publication) ;
--   * vue agrégat par type d'établissement ;
--   * vue checklist onboarding (to-do guide de démarrage) ;
--   * fonction de création atomique établissement + profil admin.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : état de l'onboarding (étapes complétées)
-- ----------------------------------------------------------------------------
create or replace view public.onboarding_progress as
with steps as (
  select
    e.id as establishment_id,
    e.name,
    e.created_at,
    e.created_by,
    case when e.description is not null and e.description <> '' then 1 else 0 end as has_description,
    case when e.cover_image_url is not null and e.cover_image_url <> '' then 1 else 0 end as has_cover,
    case when e.tour_360_url is not null and e.tour_360_url <> '' then 1 else 0 end as has_tour,
    case when e.reservation_fee_amount > 0 then 1 else 0 end as has_fee_config,
    case when (select count(*) from public.levels where establishment_id = e.id) > 0 then 1 else 0 end as has_levels,
    case when (select count(*) from public.sections s join public.levels l on l.id = s.level_id where l.establishment_id = e.id) > 0 then 1 else 0 end as has_sections,
    case when (select count(*) from public.profiles where establishment_id = e.id and role = 'professeur') > 0 then 1 else 0 end as has_teachers,
    case when (select count(*) from public.profiles where establishment_id = e.id and role in ('secretariat', 'censeur')) > 0 then 1 else 0 end as has_staff,
    case when (select count(*) from public.students where establishment_id = e.id) > 0 then 1 else 0 end as has_students,
    case when e.published_to_trouvetou = true then 1 else 0 end as is_published
  from public.establishments e
)
select
  establishment_id,
  name,
  created_at,
  has_description + has_cover + has_tour + has_fee_config + has_levels + has_sections
    + has_teachers + has_staff + has_students + is_published as steps_completed,
  10 as steps_total,
  case
    when has_description + has_cover + has_tour + has_fee_config + has_levels + has_sections
      + has_teachers + has_staff + has_students + is_published = 10 then 100
    else round(100.0 * (has_description + has_cover + has_tour + has_fee_config + has_levels + has_sections
      + has_teachers + has_staff + has_students + is_published) / 10)
  end as completion_pct,
  has_description,
  has_cover,
  has_tour,
  has_fee_config,
  has_levels,
  has_sections,
  has_teachers,
  has_staff,
  has_students,
  is_published,
  case
    when has_levels = 0 then 'Créer les niveaux (6ème, 5ème, ...)'
    when has_sections = 0 then 'Créer les sections par niveau'
    when has_teachers = 0 and has_staff = 0 then 'Inviter l''équipe (profs / secrétariat)'
    when has_students = 0 then 'Ajouter les premiers élèves'
    when is_published = 0 then 'Publier sur Trouvetou'
    when has_cover = 0 then 'Ajouter une image de couverture'
    when has_tour = 0 then 'Ajouter une visite virtuelle 360°'
    when has_fee_config = 0 then 'Configurer les frais de réservation'
    else 'Configuration complète !'
  end as next_step
from steps;

grant select on public.onboarding_progress to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : établissements incomplets
-- ----------------------------------------------------------------------------
create or replace view public.establishments_incomplete as
select *
from public.onboarding_progress
where completion_pct < 100
order by completion_pct asc, created_at asc;

grant select on public.establishments_incomplete to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : agrégat par type d'établissement
-- ----------------------------------------------------------------------------
create or replace view public.establishments_by_type as
select
  coalesce(school_type::text, 'unspecified') as school_type,
  count(*) as total,
  count(*) filter (where published_to_trouvetou = true) as published_count,
  count(*) filter (where created_at > current_date - interval '30 days') as new_30d,
  coalesce(sum((select count(*) from public.students where establishment_id = e.id)), 0) as total_students
from public.establishments e
group by school_type
order by total desc;

grant select on public.establishments_by_type to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. FONCTION : création atomique établissement + profil admin
-- ----------------------------------------------------------------------------
create or replace function public.create_establishment_with_admin(
  p_name text,
  p_city text,
  p_school_type text default null,
  p_description text default null,
  p_address text default null,
  p_reservation_fee_amount numeric default 0,
  p_actor_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment_id uuid;
begin
  -- 1. Créer l'établissement
  insert into public.establishments (
    name, city, school_type, description, address,
    reservation_fee_amount, created_by
  ) values (
    trim(p_name), trim(p_city),
    case when p_school_type is not null and p_school_type <> ''
      then p_school_type::school_type else null end,
    nullif(trim(p_description), ''),
    nullif(trim(p_address), ''),
    coalesce(p_reservation_fee_amount, 0),
    p_actor_id
  )
  returning id into v_establishment_id;

  -- 2. Lier le profil admin à l'établissement
  if p_actor_id is not null then
    update public.profiles
    set establishment_id = v_establishment_id
    where id = p_actor_id;
  end if;

  return v_establishment_id;
end;
$$;

grant execute on function public.create_establishment_with_admin(text, text, text, text, text, numeric, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : taux de complétion onboarding
-- ----------------------------------------------------------------------------
create or replace function public.compute_onboarding_completion(
  p_establishment_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pct numeric;
begin
  select completion_pct into v_pct
  from public.onboarding_progress
  where establishment_id = p_establishment_id;

  return coalesce(v_pct, 0);
end;
$$;

grant execute on function public.compute_onboarding_completion(uuid) to authenticated, service_role;
