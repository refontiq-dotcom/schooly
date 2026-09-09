-- ============================================================================
-- 00002 — Auth Hook pour Custom Claims
-- Injection du rôle et du school_id dans le JWT Supabase
-- Objectif : Routage ultra-rapide côté Middleware Next.js (sans appel SQL)
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
    -- On récupère le rôle actif de l'utilisateur qui se connecte
    select role_code, school_id into user_role, user_school
    from public.user_school_roles
    where user_id = (event->>'user_id')::uuid
      and is_active = true
    limit 1;

    claims := event->'claims';

    if user_role is not null then
        -- On injecte les données dans app_metadata (qui sera lu par le middleware Next)
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
