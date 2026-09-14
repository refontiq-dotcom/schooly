-- ============================================================================
-- SCHOOLY v1 — Auth health (cohérence auth.users ↔ profiles)
-- ============================================================================
-- Ajoute au module Auth :
--   * vue profils sans compte auth (orphelins côté auth) ;
--   * vue auth.users sans profile (sign-up incomplets) ;
--   * vue santé globale (cohérence, comptes en double, etc.) ;
--   * fonction d'audit (retourne JSON récapitulatif) ;
--   * fonction de nettoyage (suppression profile orphelin après confirmation).
--
-- IMPORTANT : idempotent. Accès en lecture seule à auth.users.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Vue : profils sans auth.users (orphelins côté auth)
-- ----------------------------------------------------------------------------
create or replace view public.profiles_orphan_auth as
select
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.role,
  p.establishment_id,
  p.created_at
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null;

grant select on public.profiles_orphan_auth to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Vue : auth.users sans profile (sign-up incomplets)
-- ----------------------------------------------------------------------------
create or replace view public.auth_users_no_profile as
select
  u.id,
  u.email,
  u.created_at as auth_created_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  case when u.banned_until is not null and u.banned_until > now() then true else false end as is_banned,
  extract(day from (now() - u.created_at))::int as days_since_signup
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email_confirmed_at is not null;

grant select on public.auth_users_no_profile to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Vue : comptes en double (même email)
-- ----------------------------------------------------------------------------
create or replace view public.duplicate_accounts as
select
  lower(trim(email)) as email_normalized,
  count(*) as account_count,
  array_agg(id order by created_at) as user_ids,
  array_agg(role order by created_at) filter (where role is not null) as roles
from public.profiles
where email is not null and email <> ''
group by lower(trim(email))
having count(*) > 1;

grant select on public.duplicate_accounts to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Vue : santé globale de l'auth (résumé)
-- ----------------------------------------------------------------------------
create or replace view public.auth_health_summary as
with stats as (
  select
    count(*) filter (where u.id is not null and p.id is not null) as consistent_accounts,
    count(*) filter (where u.id is null) as orphan_profiles,
    count(*) filter (where p.id is null and u.email_confirmed_at is not null) as auth_no_profile
  from auth.users u
  full outer join public.profiles p on p.id = u.id
)
select
  s.consistent_accounts,
  s.orphan_profiles,
  s.auth_no_profile,
  s.consistent_accounts + s.orphan_profiles as total_profiles,
  (select count(*) from auth.users) as total_auth_users,
  case
    when s.orphan_profiles = 0 and s.auth_no_profile = 0 then 'healthy'
    when s.orphan_profiles > 0 then 'has_orphan_profiles'
    when s.auth_no_profile > 0 then 'has_incomplete_signups'
    else 'healthy'
  end as health_status
from stats s;

grant select on public.auth_health_summary to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Vue : utilisateurs bannis / désactivés
-- ----------------------------------------------------------------------------
create or replace view public.banned_users as
select
  u.id,
  u.email,
  u.banned_until,
  p.full_name,
  p.role,
  p.establishment_id,
  case
    when u.banned_until is null then 'active'
    when u.banned_until > now() then 'banned'
    else 'ban_expired'
  end as status
from auth.users u
left join public.profiles p on p.id = u.id
where u.banned_until is not null
order by u.banned_until desc;

grant select on public.banned_users to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. FONCTION : audit auth (retourne JSON récapitulatif)
-- ----------------------------------------------------------------------------
create or replace function public.audit_auth_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'summary', (select to_jsonb(s.*) from public.auth_health_summary s),
    'orphan_profiles', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'full_name', full_name, 'email', email, 'role', role,
        'establishment_id', establishment_id, 'created_at', created_at
      ))
      from public.profiles_orphan_auth
    ),
    'incomplete_signups', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'auth_created_at', auth_created_at,
        'email_confirmed_at', email_confirmed_at, 'days_since_signup', days_since_signup
      ))
      from public.auth_users_no_profile
    ),
    'banned_users', (
      select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'banned_until', banned_until,
        'full_name', full_name, 'role', role
      ))
      from public.banned_users
    ),
    'duplicates', (
      select jsonb_agg(jsonb_build_object(
        'email', email_normalized, 'count', account_count, 'user_ids', user_ids
      ))
      from public.duplicate_accounts
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.audit_auth_health() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. FONCTION : nettoyage profile orphelin (avec confirmation explicite)
-- ----------------------------------------------------------------------------
create or replace function public.cleanup_orphan_profile(
  p_profile_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from public.profiles_orphan_auth
  where id = p_profile_id;

  if v_orphans = 0 then
    raise exception 'Profile % is not orphan (has matching auth.users entry)', p_profile_id;
  end if;

  delete from public.profiles where id = p_profile_id;
  return true;
end;
$$;

grant execute on function public.cleanup_orphan_profile(uuid) to authenticated, service_role;
