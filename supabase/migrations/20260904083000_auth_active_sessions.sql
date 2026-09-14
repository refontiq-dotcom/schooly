-- ============================================================================
-- SCHOOLY v1 — Auth : sessions actives
-- ============================================================================
-- Complète le module Auth santé (20260903210000_auth_health.sql) avec :
--   * vue des sessions actives (dernière connexion ≤ 24h) par établissement ;
--   * vue récapitulatif par établissement (taux d'activité, staff actif) ;
--   * fonction d'audit combinant santé auth + sessions.
--
-- IMPORTANT : idempotent. Accès en lecture seule à auth.users.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : sessions actives (users connecté·e·s ≤ 24h) par établissement
-- ----------------------------------------------------------------------------
-- Une « session active » = un compte auth.users ayant un profil rattaché à
-- l'établissement dont la dernière connexion (last_sign_in_at) remonte à
-- moins de 24 heures. On joint auth.users → profiles (par id) pour récupérer
-- l'établissement et le rôle.
create or replace view public.auth_active_sessions as
select
  u.id as user_id,
  p.establishment_id,
  e.name as establishment_name,
  p.full_name,
  p.role,
  u.email,
  u.created_at as auth_created_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.banned_until,
  case when u.banned_until is not null and u.banned_until > now() then true else false end as is_banned,
  extract(hour from (now() - u.last_sign_in_at))::int as hours_since_last_sign_in
from auth.users u
join public.profiles p on p.id = u.id
join public.establishments e on e.id = p.establishment_id
where u.last_sign_in_at is not null
  and u.last_sign_in_at > now() - interval '24 hours'
  and (u.banned_until is null or u.banned_until <= now())
order by u.last_sign_in_at desc;

grant select on public.auth_active_sessions to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : récapitulatif sessions par établissement
-- ----------------------------------------------------------------------------
create or replace view public.auth_sessions_summary as
select
  e.id as establishment_id,
  e.name as establishment_name,
  coalesce(ams.total_users, 0) as total_users,
  coalesce(ams.active_24h, 0) as active_users_24h,
  coalesce(ams.active_7d, 0) as active_users_7d,
  coalesce(ams.staff_active_24h, 0) as staff_active_24h,
  coalesce(ams.parents_active_24h, 0) as parents_active_24h,
  case when coalesce(ams.total_users, 0) = 0 then 0
    else round(100.0 * coalesce(ams.active_24h, 0) / ams.total_users)
  end as activity_rate_pct
from public.establishments e
left join (
  select
    p.establishment_id,
    count(*) as total_users,
    count(*) filter (
      where u.last_sign_in_at is not null
        and u.last_sign_in_at > now() - interval '24 hours'
        and (u.banned_until is null or u.banned_until <= now())
    ) as active_24h,
    count(*) filter (
      where u.last_sign_in_at is not null
        and u.last_sign_in_at > now() - interval '7 days'
        and (u.banned_until is null or u.banned_until <= now())
    ) as active_7d,
    count(*) filter (
      where u.last_sign_in_at is not null
        and u.last_sign_in_at > now() - interval '24 hours'
        and (u.banned_until is null or u.banned_until <= now())
        and p.role in ('admin','professeur','secretariat','censeur')
    ) as staff_active_24h,
    count(*) filter (
      where u.last_sign_in_at is not null
        and u.last_sign_in_at > now() - interval '24 hours'
        and (u.banned_until is null or u.banned_until <= now())
        and p.role = 'parent'
    ) as parents_active_24h
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.establishment_id is not null
  group by p.establishment_id
) ams on ams.establishment_id = e.id
order by e.name;

grant select on public.auth_sessions_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. FONCTION : audit session + santé (combiné)
-- ----------------------------------------------------------------------------
create or replace function public.audit_sessions_and_health(
  p_establishment_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  select to_jsonb(s.*) into v_summary
  from public.auth_sessions_summary s
  where s.establishment_id = p_establishment_id;

  if v_summary is null then
    return jsonb_build_object(
      'establishment_id', p_establishment_id,
      'error', 'Établissement introuvable ou sans profils'
    );
  end if;

  return v_summary || jsonb_build_object(
    'auth_health', (select to_jsonb(h.*) from public.auth_health_summary h),
    'banned_count', (
      select count(*) from public.banned_users b
      where b.establishment_id = p_establishment_id
    ),
    'orphan_profiles', (
      select count(*) from public.profiles_orphan_auth po
      where po.establishment_id = p_establishment_id
    )
  );
end;
$$;

grant execute on function public.audit_sessions_and_health(uuid) to authenticated, service_role;
