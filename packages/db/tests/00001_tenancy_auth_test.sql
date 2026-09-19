begin;

-- Import de pgTAP (Supabase l'inclut nativement dans son environnement de test)
create extension if not exists pgtap;

select plan(7);

-- ============================================================================
-- 1. PRÉPARATION DES DONNÉES DE TEST (En tant que superutilisateur)
-- ============================================================================

-- On désactive temporairement les triggers pour ne pas déclencher la création
-- automatique de public.users via l'insert dans auth.users
alter table auth.users disable trigger all;

insert into auth.users (id, email) values 
  ('11111111-1111-1111-1111-111111111111', 'super@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'dira@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'dirb@test.com');

alter table auth.users enable trigger all;

-- On insère manuellement dans public.users
insert into public.users (id, full_name, email) values 
  ('11111111-1111-1111-1111-111111111111', 'Direction A', 'super@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'Dir A', 'dira@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'Dir B', 'dirb@test.com');

insert into public.schools (id, name, city) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'School A', 'Abidjan'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'School B', 'Bouaké');

insert into public.user_school_roles (user_id, school_id, role_code) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direction'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direction'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'direction');

insert into public.school_features (school_id, feature, enabled) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'transport', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'transport', false);


-- ============================================================================
-- 2. DÉMARRAGE DES TESTS RLS
-- ============================================================================

-- On bascule dans le rôle authentifié classique (pour activer RLS)
set local role authenticated;


-- ----------------------------------------------------------------------------
-- TEST 1 & 2 : chaque Directeur voit uniquement son établissement
-- ----------------------------------------------------------------------------

-- Connexion en tant que Super Admin
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  'select count(*)::int from public.schools',
  ARRAY[1],
  'RLS - Direction A ne voit que son établissement'
);

-- Connexion en tant que Directeur de l''école A
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  'select id from public.schools',
  ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'RLS - Direction A ne doit voir QUE l''École A'
);


-- ----------------------------------------------------------------------------
-- TEST 3 : Le Directeur A peut modifier son école (UPDATE policy)
-- ----------------------------------------------------------------------------

select lives_ok(
  $$ update public.schools set city = 'Yamoussoukro' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'RLS - Direction A peut mettre à jour son école'
);


-- ----------------------------------------------------------------------------
-- TEST 4 & 5 : Isolement sur les Features (Configuration de l'école)
-- ----------------------------------------------------------------------------

select results_eq(
  'select school_id from public.school_features',
  ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid],
  'RLS - Direction A ne voit que les features de l''École A'
);

-- L'UPDATE sur l'école B ne doit pas échouer (RLS silencieux) mais doit modifier 0 ligne
update public.school_features set enabled = true where school_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select results_eq(
  $ select enabled from public.school_features where school_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $,
  ARRAY[true],
  'RLS - Direction A conserve sa feature active'
);


-- ----------------------------------------------------------------------------
-- TEST 6 & 7 : Confidentialité des données Utilisateurs (users)
-- ----------------------------------------------------------------------------

-- Reconnexion en Directeur A
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

-- Direction A doit voir uniquement son propre utilisateur
-- Elle ne DOIT PAS voir Direction B
select results_eq(
  $$ select email from public.users order by email $$,
  ARRAY['dira@test.com'::text],
  'RLS - Direction A ne peut voir que les utilisateurs rattachés à son école'
);

-- Et on vérifie que Direction A peut modifier son propre compte
select lives_ok(
  $$ update public.users set full_name = 'Dir A modifié' where id = '22222222-2222-2222-2222-222222222222' $$,
  'RLS - Un utilisateur peut modifier ses propres informations'
);

-- Fin des tests pgTAP
select * from finish();
rollback;
