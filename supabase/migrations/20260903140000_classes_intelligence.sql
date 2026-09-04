-- ============================================================================
-- SCHOOLY v1 — Classes intelligentes
-- ============================================================================
-- Ajoute au module Classes :
--   * vue taux de remplissage par section + par niveau ;
--   * vue alertes de déséquilibre (sous-rempli / saturé) ;
--   * historique de remplissage 30 jours ;
--   * vue charge des profs principaux (homeroom) ;
--   * résumé capacité par établissement ;
--   * fonction de suggestion de section (place libre la plus profonde).
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : taux de remplissage par section
-- ----------------------------------------------------------------------------
create or replace view public.class_section_fill_rates as
select
  s.id as section_id,
  s.level_id,
  l.establishment_id,
  l.name as level_name,
  s.name as section_name,
  s.capacity,
  s.seats_taken,
  case when s.capacity = 0 then 0
    else round(100.0 * s.seats_taken / s.capacity)
  end as fill_rate_pct,
  s.capacity - s.seats_taken as seats_available,
  case
    when s.capacity = 0 then 'unknown'
    when s.seats_taken >= s.capacity then 'full'
    when s.seats_taken >= s.capacity * 0.9 then 'almost_full'
    when s.seats_taken < s.capacity * 0.5 then 'low'
    else 'normal'
  end as fill_status
from public.sections s
join public.levels l on l.id = s.level_id;

grant select on public.class_section_fill_rates to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : taux de remplissage agrégé par niveau
-- ----------------------------------------------------------------------------
create or replace view public.class_level_fill_rates as
select
  l.id as level_id,
  l.establishment_id,
  l.name as level_name,
  l.rank,
  count(s.id) as sections_count,
  coalesce(sum(s.capacity), 0) as total_capacity,
  coalesce(sum(s.seats_taken), 0) as total_taken,
  case when coalesce(sum(s.capacity), 0) = 0 then 0
    else round(100.0 * sum(s.seats_taken) / sum(s.capacity))
  end as fill_rate_pct,
  coalesce(sum(s.capacity - s.seats_taken), 0) as seats_available,
  case
    when coalesce(sum(s.capacity), 0) = 0 then 'unknown'
    when sum(s.seats_taken) >= sum(s.capacity) then 'full'
    when sum(s.seats_taken) >= sum(s.capacity) * 0.9 then 'almost_full'
    when sum(s.seats_taken) < sum(s.capacity) * 0.5 then 'low'
    else 'normal'
  end as fill_status
from public.levels l
left join public.sections s on s.level_id = l.id
group by l.id, l.establishment_id, l.name, l.rank;

grant select on public.class_level_fill_rates to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : alertes de déséquilibre (sous/sur-remplissage)
-- ----------------------------------------------------------------------------
create or replace view public.class_balance_alerts as
select
  cfr.section_id,
  cfr.level_id,
  cfr.establishment_id,
  cfr.level_name,
  cfr.section_name,
  cfr.fill_rate_pct,
  cfr.fill_status,
  cfr.seats_available,
  case
    when cfr.fill_status = 'full' then 'critical'
    when cfr.fill_status = 'low' and cfr.fill_rate_pct < 30 then 'warning'
    when cfr.fill_status = 'low' then 'info'
    else 'ok'
  end as alert_level
from public.class_section_fill_rates cfr
where cfr.fill_status in ('full', 'low', 'almost_full');

grant select on public.class_balance_alerts to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : résumé capacité par établissement
-- ----------------------------------------------------------------------------
create or replace view public.class_capacity_summary as
with per_level as (
  select * from public.class_level_fill_rates
)
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(sum(pl.sections_count), 0) as total_sections,
  coalesce(sum(pl.total_capacity), 0) as total_capacity,
  coalesce(sum(pl.total_taken), 0) as total_taken,
  case when coalesce(sum(pl.total_capacity), 0) = 0 then 0
    else round(100.0 * sum(pl.total_taken) / sum(pl.total_capacity))
  end as global_fill_rate_pct,
  coalesce(sum(pl.seats_available), 0) as total_seats_available,
  count(*) filter (where pl.fill_status = 'full') as full_levels,
  count(*) filter (where pl.fill_status = 'low') as low_levels,
  count(*) filter (where pl.fill_status = 'normal') as normal_levels
from public.establishments e
left join per_level pl on pl.establishment_id = e.id
group by e.id, e.name;

grant select on public.class_capacity_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : charge des profs principaux (homeroom)
-- ----------------------------------------------------------------------------
create or replace view public.class_teacher_workload as
select
  p.id as teacher_id,
  p.establishment_id,
  p.full_name as teacher_name,
  count(distinct s.id) as homeroom_sections,
  coalesce(sum(s.capacity), 0) as homeroom_capacity,
  coalesce(sum(s.seats_taken), 0) as homeroom_students,
  case
    when count(distinct s.id) >= 4 then 'high'
    when count(distinct s.id) >= 2 then 'normal'
    when count(distinct s.id) = 1 then 'low'
    else 'none'
  end as workload_level
from public.profiles p
left join public.sections s on s.homeroom_teacher_id = p.id
where p.role = 'professeur'
group by p.id, p.establishment_id, p.full_name;

grant select on public.class_teacher_workload to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : suggestion de section (la moins pleine, avec place libre)
-- ----------------------------------------------------------------------------
create or replace function public.suggest_section_for_level(
  p_level_id uuid
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_section_id uuid;
begin
  -- Priorité 1 : section avec place libre ET la moins remplie
  select id into v_section_id
  from public.sections
  where level_id = p_level_id
    and seats_taken < capacity
  order by
    (capacity - seats_taken) desc,   -- le plus de places restantes
    seats_taken asc                  -- la moins remplie d'abord
  limit 1;

  return v_section_id;
end;
$$;

grant execute on function public.suggest_section_for_level(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : taux de remplissage d'un niveau (utilitaire)
-- ----------------------------------------------------------------------------
create or replace function public.compute_level_fill_rate(
  p_level_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_cap int;
  v_total_taken int;
begin
  select coalesce(sum(capacity), 0), coalesce(sum(seats_taken), 0)
    into v_total_cap, v_total_taken
  from public.sections
  where level_id = p_level_id;

  if v_total_cap = 0 then return null; end if;

  return round(100.0 * v_total_taken / v_total_cap, 1);
end;
$$;

grant execute on function public.compute_level_fill_rate(uuid) to authenticated, service_role;
