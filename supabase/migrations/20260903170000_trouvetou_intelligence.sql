-- ============================================================================
-- SCHOOLY v1 — Trouvetou intelligence
-- ============================================================================
-- Ajoute au module Trouvetou :
--   * colonne source sur reservations (tracking canal) ;
--   * mise à jour create_trouvetou_reservation (source = 'trouvetou') ;
--   * vue catalogue public (établissements publiés + sections dispo) ;
--   * vue performance par établissement (réservations via Trouvetou) ;
--   * vue performance des pubs (ads actives / expirées) ;
--   * vue entonnoir de conversion (pub → réservation → confirmée) ;
--   * fonction de calcul du taux de conversion.
--
-- IMPORTANT : idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Colonne source sur reservations (tracking canal)
-- ----------------------------------------------------------------------------
do $$ begin
  alter table public.reservations
    add column if not exists source text not null default 'direct';
exception when others then null;
end $$;

create index if not exists idx_reservations_source
  on public.reservations (source, created_at);

-- ----------------------------------------------------------------------------
-- 0a. Mise à jour de create_trouvetou_reservation : ajout source = 'trouvetou'
-- ----------------------------------------------------------------------------
create or replace function public.create_trouvetou_reservation(
  p_establishment_id uuid,
  p_level_id uuid,
  p_student_full_name text,
  p_student_birthdate date default null,
  p_parent_full_name text default null,
  p_parent_phone text default null,
  p_parent_email text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment public.establishments;
  v_section public.sections;
  v_reservation public.reservations;
begin
  if nullif(trim(p_student_full_name), '') is null
     or nullif(trim(p_parent_full_name), '') is null
     or nullif(trim(p_parent_phone), '') is null then
    raise exception 'Nom de l''élève, nom du parent et téléphone requis';
  end if;

  select * into v_establishment
  from public.establishments
  where id = p_establishment_id
    and published_to_trouvetou = true;

  if v_establishment is null then
    raise exception 'Établissement non publié dans Trouvetou';
  end if;

  if not exists (
    select 1 from public.levels
    where id = p_level_id and establishment_id = p_establishment_id
  ) then
    raise exception 'Niveau invalide pour cet établissement';
  end if;

  select * into v_section
  from public.sections
  where level_id = p_level_id
    and seats_taken < capacity
  order by name
  limit 1
  for update;

  if v_section is null then
    raise exception 'Plus de place disponible pour ce niveau';
  end if;

  insert into public.reservations (
    establishment_id, level_id, section_id, student_full_name,
    student_birthdate, parent_full_name, parent_phone, parent_email,
    status, source
  ) values (
    p_establishment_id, p_level_id, v_section.id, trim(p_student_full_name),
    p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
    nullif(trim(p_parent_email), ''), 'pending_payment', 'trouvetou'
  ) returning * into v_reservation;

  return v_reservation;
end;
$$;

grant execute on function public.create_trouvetou_reservation(uuid, uuid, text, date, text, text, text) to authenticated, service_role;

revoke all on function public.create_trouvetou_reservation(uuid, uuid, text, date, text, text, text)
  from public, anon;

-- ----------------------------------------------------------------------------
-- 1. Vue : catalogue public Trouvetou (établissements publiés)
-- ----------------------------------------------------------------------------
create or replace view public.trouvetou_public_catalog as
select
  e.id as establishment_id,
  e.name,
  e.city,
  e.school_type,
  e.published_to_trouvetou,
  e.reservation_hold_hours,
  count(distinct l.id) as levels_count,
  count(distinct s.id) as sections_count,
  coalesce(sum(s.capacity - s.seats_taken), 0) as total_seats_available,
  array_agg(distinct l.name order by l.name) filter (where l.name is not null) as level_names
from public.establishments e
left join public.levels l on l.establishment_id = e.id
left join public.sections s on s.level_id = l.id
where e.published_to_trouvetou = true
group by e.id, e.name, e.city, e.school_type, e.published_to_trouvetou, e.reservation_hold_hours;

grant select on public.trouvetou_public_catalog to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : performance Trouvetou par établissement
-- ----------------------------------------------------------------------------
create or replace view public.trouvetou_performance as
select
  r.establishment_id,
  e.name as establishment_name,
  e.city,
  e.published_to_trouvetou,
  r.source,
  count(*) as total_reservations,
  count(*) filter (where r.source = 'trouvetou') as trouvetou_reservations,
  count(*) filter (where r.status = 'confirmed') as confirmed_reservations,
  count(*) filter (where r.status = 'expired') as expired_reservations,
  count(*) filter (where r.status = 'cancelled') as cancelled_reservations,
  coalesce(sum(r.amount_paid) filter (where r.status = 'confirmed'), 0) as total_revenue,
  count(*) filter (where r.created_at > current_date - interval '30 days') as reservations_30d,
  count(*) filter (where r.source = 'trouvetou' and r.created_at > current_date - interval '30 days') as trouvetou_30d
from public.reservations r
join public.establishments e on e.id = r.establishment_id
where e.published_to_trouvetou = true
group by r.establishment_id, e.name, e.city, e.published_to_trouvetou, r.source;

grant select on public.trouvetou_performance to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : performance des publicités Trouvetou
-- ----------------------------------------------------------------------------
create or replace view public.trouvetou_ads_performance as
select
  a.establishment_id,
  e.name as establishment_name,
  count(*) as total_ads,
  count(*) filter (where a.active = true) as active_ads,
  count(*) filter (where a.active = true
    and (a.ends_at is null or a.ends_at > now())
    and a.starts_at <= now()) as currently_live_ads,
  count(*) filter (where a.ends_at is not null and a.ends_at < now()) as expired_ads,
  count(*) filter (where a.starts_at > now()) as scheduled_ads,
  min(a.starts_at) filter (where a.starts_at > now()) as next_start,
  max(a.ends_at) filter (where a.active = true) as latest_end
from public.trouvetou_ads a
join public.establishments e on e.id = a.establishment_id
group by a.establishment_id, e.name;

grant select on public.trouvetou_ads_performance to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : entonnoir de conversion Trouvetou
-- ----------------------------------------------------------------------------
create or replace view public.trouvetou_conversion_funnel as
with per_est as (
  select
    r.establishment_id,
    e.name as establishment_name,
    count(*) as total_reservations,
    count(*) filter (where r.source = 'trouvetou') as trouvetou_received,
    count(*) filter (where r.source = 'trouvetou' and r.status = 'reserved') as trouvetou_awaiting_payment,
    count(*) filter (where r.source = 'trouvetou' and r.status = 'confirmed') as trouvetou_confirmed,
    count(*) filter (where r.source = 'trouvetou' and r.status = 'expired') as trouvetou_expired
  from public.reservations r
  join public.establishments e on e.id = r.establishment_id
  where e.published_to_trouvetou = true
  group by r.establishment_id, e.name
)
select
  establishment_id,
  establishment_name,
  total_reservations,
  trouvetou_received,
  trouvetou_awaiting_payment,
  trouvetou_confirmed,
  trouvetou_expired,
  case when trouvetou_received = 0 then null
    else round(100.0 * trouvetou_confirmed / trouvetou_received)
  end as conversion_rate_pct,
  case when trouvetou_received = 0 then null
    else round(100.0 * trouvetou_expired / trouvetou_received)
  end as expiry_rate_pct
from per_est;

grant select on public.trouvetou_conversion_funnel to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. FONCTION : taux de conversion Trouvetou d'un établissement
-- ----------------------------------------------------------------------------
create or replace function public.compute_trouvetou_conversion_rate(
  p_establishment_id uuid,
  p_days int default 90
) returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int;
  v_confirmed int;
begin
  select count(*)
    into v_total
  from public.reservations
  where establishment_id = p_establishment_id
    and source = 'trouvetou'
    and created_at > current_date - (p_days || ' days')::interval;

  if v_total = 0 then return null; end if;

  select count(*)
    into v_confirmed
  from public.reservations
  where establishment_id = p_establishment_id
    and source = 'trouvetou'
    and status = 'confirmed'
    and created_at > current_date - (p_days || ' days')::interval;

  return round(100.0 * v_confirmed / v_total, 1);
end;
$$;

grant execute on function public.compute_trouvetou_conversion_rate(uuid, int) to authenticated, service_role;
