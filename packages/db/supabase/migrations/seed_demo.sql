-- ============================================================================
-- SEED : Données de Démonstration — PARTIE 1 (À exécuter maintenant)
-- École fictive "Groupe Scolaire Étoile d'Abidjan"
-- ⚠️ NE JAMAIS utiliser en production
-- ============================================================================

-- Étape 1 : Créer l'école de test
INSERT INTO public.schools (id, name, city, school_type) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Groupe Scolaire Étoile d''Abidjan', 'Abidjan', 'college')
ON CONFLICT (id) DO UPDATE SET name = excluded.name;

-- Étape 2 : Activer quelques modules à la carte pour l'école de démo
INSERT INTO public.school_features (school_id, feature, enabled) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'transport',    false),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'cantine',      true),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'internat',     false),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'bibliotheque', true),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'trouvetou',    true)
ON CONFLICT (school_id, feature) DO UPDATE SET enabled = excluded.enabled;

-- ============================================================================
-- PARTIE 2 — Attribution des rôles (via recherche par email)
-- Pas besoin des UUIDs — le trigger a déjà créé les lignes dans public.users
-- Mot de passe de test : demo123456
-- ============================================================================

INSERT INTO public.user_school_roles (user_id, school_id, role_code, is_active)
SELECT u.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'super_admin', true
FROM public.users u WHERE u.email = 'super@schooly.test'
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

INSERT INTO public.user_school_roles (user_id, school_id, role_code, is_active)
SELECT u.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'direction', true
FROM public.users u WHERE u.email = 'direction@etoile.test'
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

INSERT INTO public.user_school_roles (user_id, school_id, role_code, is_active)
SELECT u.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'compta', true
FROM public.users u WHERE u.email = 'compta@etoile.test'
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

INSERT INTO public.user_school_roles (user_id, school_id, role_code, is_active)
SELECT u.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'caisse', true
FROM public.users u WHERE u.email = 'caisse@etoile.test'
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

INSERT INTO public.user_school_roles (user_id, school_id, role_code, is_active)
SELECT u.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'professeur', true
FROM public.users u WHERE u.email = 'prof@etoile.test'
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;



