-- ============================================================================
-- 00003 — Custom Access Token Hook : claims rôle/école dans le JWT (P2-3)
--
-- Le hook est exécuté par Supabase Auth À CHAQUE émission/refresh d'access
-- token : il injecte `app_metadata.role` et `app_metadata.school_id` dans le
-- JWT. Le middleware Next.js lit alors ces claims localement (décodage du
-- cookie) au lieu d'interroger la base à chaque requête sur les écrans
-- d'entrée — cf. utils/supabase/middleware.ts (resolveHomePath).
--
-- Le tri reprend le comportement du repli base : le rôle le plus ANCIEN
-- (created_at asc) gagne, pour un routage déterministe multi-rôles.
--
-- ⚠️ Enregistrement (Supabase hébergé) : Dashboard → Authentication →
--    Hooks → Custom Access Token → sélectionner public.custom_access_token_hook.
--    Idempotent (create or replace) : réexécution sans risque.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    claims jsonb;
    user_role text;
    user_school uuid;
begin
    -- Rôle actif le plus ancien (déterministe en cas de rôles multiples)
    select role_code, school_id into user_role, user_school
    from public.user_school_roles
    where user_id = (event->>'user_id')::uuid
      and is_active = true
    order by created_at asc
    limit 1;

    claims := event->'claims';

    if user_role is not null then
        -- Injection dans app_metadata (lu par le middleware Next.js)
        claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
        claims := jsonb_set(claims, '{app_metadata, school_id}', to_jsonb(user_school));
    end if;

    event := jsonb_set(event, '{claims}', claims);
    return event;
end;
$$;

-- Permissions nécessaires pour que Supabase Auth puisse utiliser ce hook
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
