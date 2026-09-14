-- ============================================================================
-- SCHOOLY — Restauration des GRANT EXECUTE (post-migrations)
--
-- Les grants de 20260902120000_fix_grants_and_rls.sql avaient été neutralisés
-- car les fonctions ciblées n'existaient pas encore au moment de l'écriture.
-- La base complète est désormais appliquée en 20260902000000 (avant toutes les
-- autres) : les fonctions existent, les grants peuvent être posés proprement.
--
-- Note : la base granter déjà ces fonctions ; ce fichier reste le point de
-- vérité explicite (posture Supabase : REVOKE EXECUTE par défaut à PUBLIC).
-- Idempotent : chaque grant n'est exécuté que si la fonction existe.
-- ============================================================================

do $$
declare
  target text;
begin
  -- RPC d'authentification / rôles
  target := 'public.ensure_own_profile()';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated', target);
  end if;

  -- RPC admin : création d'établissement (2 overloads : legacy 4 args, 5 args + school_type)
  target := 'public.create_establishment_as_admin(text, text, text, text)';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated', target);
  end if;

  target := 'public.create_establishment_as_admin(text, text, text, text, school_type)';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated', target);
  end if;

  -- RPC staff : acceptation d'invitation
  target := 'public.accept_staff_invitation(uuid)';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated', target);
  end if;

  -- RPC finalisation : overload legacy (1 arg) et atomique secrétariat (3 args)
  target := 'public.finalize_reservation(uuid)';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated', target);
  end if;

  target := 'public.finalize_reservation(uuid, uuid, uuid)';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to authenticated, service_role', target);
  end if;

  -- Helper RLS security definer (remplace les sous-requêtes auto-référentes)
  target := 'public.my_profile()';
  if to_regprocedure(target) is not null then
    execute format('grant execute on function %s to anon, authenticated, service_role', target);
  end if;
end
$$;
