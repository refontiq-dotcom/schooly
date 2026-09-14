-- ============================================================================
-- SCHOOLY — Correctif live (2 septembre 2026)
-- Projet Supabase : pprsngmvrkxbzuvghgef
--
-- Corrige 2 problèmes détectés lors de la création du compte de démo :
--   1) Privilèges manquants : les tables de base ne sont accessibles ni par
--      `anon`, ni par `authenticated`, ni par `service_role`
--      (erreur 42501 "permission denied for table …").
--   2) Récursion infinie RLS sur `profiles` : la policy staff interroge
--      `profiles` elle-même (erreur 42P17 "infinite recursion detected in
--      policy for relation profiles").
--
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query > Run.
-- Idempotent : peut être relancé sans risque.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Privilèges — posture par défaut Supabase.
--    La RLS (activée sur toutes les tables du schéma) reste le filtre réel :
--    un GRANT large ne rend visibles que les lignes autorisées par les policies.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to anon, authenticated, service_role;

-- Fonctions RPC appelées par l'application (re-grant idempotent par sécurité)

-- grant execute on function public.create_establishment_as_admin(text, text, text, text) to authenticated;
-- grant execute on function public.accept_staff_invitation(uuid) to authenticated;
-- grant execute on function public.finalize_reservation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Helper RLS : lit le profil de l'utilisateur courant SANS déclencher la
--    RLS de `profiles` (security definer). Remplace les sous-requêtes
--    auto-référentes, source de la récursion infinie.
-- ----------------------------------------------------------------------------
create or replace function public.my_profile()
returns table (id uuid, establishment_id uuid, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.establishment_id, p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

-- grant execute on function public.my_profile() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Reconstruit TOUTES les policies de `profiles`, quels que soient leurs
--    noms. La policy d'origine récursive ("Staff accède aux données de son
--    établissement", nom sans suffixe dans la base existante) est donc
--    forcément supprimée → plus jamais de 42P17 infinite recursion.
-- ----------------------------------------------------------------------------
alter table public.profiles no force row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- a) Chacun voit son propre profil.
create policy "Un utilisateur voit son profil"
  on public.profiles for select
  using (auth.uid() = id);

-- b) Le staff (admin, censeur, secrétariat, professeur) voit les profils de
--    son établissement — via le helper security definer, donc sans jamais
--    réinterroger `profiles` sous RLS (zéro auto-référence, zéro récursion).
create policy "Staff accède aux données de son établissement (profiles)"
  on public.profiles for select
  using (
    establishment_id in (
      select mp.establishment_id
      from public.my_profile() mp
      where mp.role in ('admin', 'censeur', 'secretariat', 'professeur')
    )
  );

-- c) Chacun met à jour ses propres informations (le trigger profiles_guard
--    empêche de changer role / establishment_id / email).
create policy "Un utilisateur met à jour son nom et téléphone"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
