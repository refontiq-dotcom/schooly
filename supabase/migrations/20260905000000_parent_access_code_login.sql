-- ============================================================================
-- PARENT ACCESS CODE — authentification parent par code PIN 4 chiffres
-- Remplace le flux magic-link / mot de passe hardcodé (Schooly2024!)
-- ============================================================================
-- Idempotent : chaque bloc commence par DROP IF EXISTS / IF NOT EXISTS.
-- pgcrypto est requis (déjà activé dans schema.sql).

-- ---------------------------------------------------------------------------
-- 1. TABLE parent_access_codes
-- ---------------------------------------------------------------------------
drop table if exists public.parent_access_codes;

create table if not exists public.parent_access_codes (
  parent_profile_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  failed_attempts int not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. FONCTIONS RPC (security definer, appelées côté serveur uniquement)
-- ---------------------------------------------------------------------------

drop function if exists public.setup_parent_access_code(uuid, text);
create or replace function public.setup_parent_access_code(p_profile_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salt text;
  v_hash text;
begin
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    raise exception 'Le code doit être composé de 4 chiffres.';
  end if;

  if exists (
    select 1 from public.parent_access_codes
    where parent_profile_id = p_profile_id
      and (locked_until is not null and locked_until > now())
  ) then
    raise exception 'Ce compte est temporairement verrouillé.';
  end if;

  v_salt := encode(gen_random_bytes(16), 'hex');
  v_hash := encode(scrypt(p_pin, decode(v_salt, 'hex'), 16, 1, 1, 12), 'hex');

  insert into public.parent_access_codes (parent_profile_id, pin_hash, pin_salt, expires_at)
  values (p_profile_id, v_hash, v_salt, now() + interval '72 hours')
  on conflict (parent_profile_id) do
    update set
      pin_hash = excluded.pin_hash,
      pin_salt = excluded.pin_salt,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now();
end;
$$;

drop function if exists public.verify_parent_access_code(uuid, text);
create or replace function public.verify_parent_access_code(p_profile_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_expected text;
  v_input text;
begin
  if p_profile_id is null or p_pin is null then
    return false;
  end if;

  select * into v from public.parent_access_codes where parent_profile_id = p_profile_id;
  if v is null then
    return false;
  end if;

  if (v.locked_until is not null and v.locked_until > now()) then
    return false;
  end if;
  if v.expires_at < now() then
    return false;
  end if;

  v_expected := v.pin_hash;
  v_input := encode(scrypt(p_pin, decode(v.pin_salt, 'hex'), 16, 1, 1, 12), 'hex');

  if length(v_input) <> length(v_expected) then
    perform public.record_failed_attempt(p_profile_id);
    return false;
  end if;

  if v_input = v_expected then
    update public.parent_access_codes
      set failed_attempts = 0, locked_until = null, updated_at = now()
      where parent_profile_id = p_profile_id;
    return true;
  else
    perform public.record_failed_attempt(p_profile_id);
    return false;
  end if;
end;
$$;

drop function if exists public.record_failed_attempt(uuid);
create or replace function public.record_failed_attempt(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    return;
  end if;

  update public.parent_access_codes
    set
      failed_attempts = case
        when failed_attempts >= 4 then 5
        else failed_attempts + 1
      end,
      locked_until = case
        when failed_attempts >= 4 then now() + interval '30 minutes'
        else locked_until
      end,
      updated_at = now()
    where parent_profile_id = p_profile_id;
end;
$$;

drop function if exists public.reset_parent_access_code(uuid);
create or replace function public.reset_parent_access_code(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.parent_access_codes where parent_profile_id = p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. SÉCURITÉ / DROITS
-- ---------------------------------------------------------------------------
-- RLS : désactivé volontairement (accès uniquement via les fonctions service role).
alter table public.parent_access_codes disable row level security;

revoke all on function public.setup_parent_access_code(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_parent_access_code(uuid, text) from public, anon, authenticated;
revoke all on function public.record_failed_attempt(uuid) from public, anon, authenticated;
revoke all on function public.reset_parent_access_code(uuid) from public, anon, authenticated;

-- (Les fonctions sont appelées depuis le backend en service role.
--  Si vous utilisez un client RLS pour signInParent, activez les grants ci-dessous
--  après révision de la surface d'attaque.)
-- grant execute on function public.setup_parent_access_code(uuid, text) to service_role;
-- grant execute on function public.verify_parent_access_code(uuid, text) to service_role;
-- grant execute on function public.reset_parent_access_code(uuid, text) to service_role;
