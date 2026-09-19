-- ============================================================================
-- SEED : Données de Démonstration — Schooly (idempotent)
-- École fictive "Groupe Scolaire Étoile d'Abidjan"
-- ⚠️ NE JAMAIS exécuter en production.
-- Mot de passe de test : demo123456
-- Les lignes public.users sont créées par le trigger d'inscription Auth
-- (hook auth) — le seed n'attribue que les rôles par école.
-- ============================================================================

-- Étape 1 : École de test
INSERT INTO public.schools (id, name, city, school_type) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Groupe Scolaire Étoile d''Abidjan', 'Abidjan', 'college')
ON CONFLICT (id) DO UPDATE SET name = excluded.name;

-- Étape 2 : Modules à la carte
INSERT INTO public.school_features (school_id, feature, enabled) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'transport',    false),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'cantine',      true),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'internat',     false),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'bibliotheque', true),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'trouvetou',    true)
ON CONFLICT (school_id, feature) DO UPDATE SET enabled = excluded.enabled;

-- Étape 3 : Rôles (via recherche par email)
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

-- ============================================================================
-- SEED — PARTIE 4 : Années académiques (Phase 11, test de la bascule)
-- Idempotent (ON CONFLICT).
-- ============================================================================

-- Année précédente (clôturée) — inscriptions à promouvoir
INSERT INTO public.academic_years (id, school_id, label, start_date, end_date, status) VALUES
  ('a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '2024-2025', '2024-09-16', '2025-07-04', 'cloturee')
ON CONFLICT (school_id, label) DO UPDATE SET status = excluded.status;

-- Année en cours — destination de la bascule
INSERT INTO public.academic_years (id, school_id, label, start_date, end_date, status) VALUES
  ('a1b2c3d4-1111-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '2025-2026', '2025-09-15', '2026-07-03', 'en_cours')
ON CONFLICT (school_id, label) DO UPDATE SET status = excluded.status;

-- Année suivante (planifiée) — pour les futures bascules
INSERT INTO public.academic_years (id, school_id, label, start_date, end_date, status) VALUES
  ('a1b2c3d4-2222-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '2026-2027', '2026-09-14', '2027-07-02', 'planifiee')
ON CONFLICT (school_id, label) DO UPDATE SET status = excluded.status;

-- Niveaux (pérennes, pas d'année académique)
-- ⚠️ `level` = ordre de PROGRESSION croissant (6ème avant 5ème) — la bascule
-- promeut via level+1 ; l'UI trie ascending.
INSERT INTO public.grade_levels (id, school_id, name, level, cycle) VALUES
  ('b1111111-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '6ème', 1, 'collège'),
  ('b2222222-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '5ème', 2, 'collège')
ON CONFLICT (school_id, name) DO UPDATE SET level = excluded.level;

-- Classes
INSERT INTO public.classes (id, school_id, grade_level_id, name, capacity) VALUES
  ('c1111111-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', '6ème A', 40),
  ('c2222222-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'b2222222-0000-4372-a567-0e02b2c3d479', '5ème A', 40)
ON CONFLICT (school_id, name) DO NOTHING;

-- Élèves de test (6)
INSERT INTO public.students (id, school_id, first_name, last_name, date_of_birth, gender, status) VALUES
  ('d1111111-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Awa', 'Konaté', '2012-03-12', 'F', 'active'),
  ('d2222222-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Ibrahim', 'Traoré', '2012-06-25', 'M', 'active'),
  ('d3333333-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Fatou', 'Bamba', '2012-01-08', 'F', 'active'),
  ('d4444444-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Yao', 'N''Guessan', '2012-11-30', 'M', 'active'),
  ('d5555555-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Mariam', 'Ouattara', '2012-04-17', 'F', 'active'),
  ('d6666666-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Aboubacar', 'Sylla', '2012-09-02', 'M', 'active')
ON CONFLICT (id) DO NOTHING;

-- Tuteurs
INSERT INTO public.guardians (id, phone, full_name) VALUES
  ('e1111111-0000-4372-a567-0e02b2c3d479', '+2250700000001', 'Salif Konaté'),
  ('e2222222-0000-4372-a567-0e02b2c3d479', '+2250700000002', 'Adama Traoré'),
  ('e3333333-0000-4372-a567-0e02b2c3d479', '+2250700000003', 'Kadidja Bamba'),
  ('e4444444-0000-4372-a567-0e02b2c3d479', '+2250700000004', 'Michel N''Guessan'),
  ('e5555555-0000-4372-a567-0e02b2c3d479', '+2250700000005', 'Lassina Ouattara'),
  ('e6666666-0000-4372-a567-0e02b2c3d479', '+2250700000006', 'Ramata Sylla')
ON CONFLICT (id) DO NOTHING;

-- Inscriptions 2024-2025 (année clôturée)
INSERT INTO public.enrollments (id, school_id, student_id, guardian_id, grade_level_id, class_id, academic_year_id, enrollment_date, status, matricule) VALUES
  ('f1111111-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd1111111-0000-4372-a567-0e02b2c3d479', 'e1111111-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-16', 'confirmed', '2024-0001'),
  ('f2222222-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd2222222-0000-4372-a567-0e02b2c3d479', 'e2222222-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-16', 'confirmed', '2024-0002'),
  ('f3333333-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd3333333-0000-4372-a567-0e02b2c3d479', 'e3333333-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-17', 'confirmed', '2024-0003'),
  ('f4444444-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd4444444-0000-4372-a567-0e02b2c3d479', 'e4444444-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-17', 'confirmed', '2024-0004'),
  ('f5555555-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd5555555-0000-4372-a567-0e02b2c3d479', 'e5555555-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-18', 'confirmed', '2024-0005'),
  ('f6666666-0000-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'd6666666-0000-4372-a567-0e02b2c3d479', 'e6666666-0000-4372-a567-0e02b2c3d479', 'b1111111-0000-4372-a567-0e02b2c3d479', 'c1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', '2024-09-18', 'confirmed', '2024-0006')
ON CONFLICT (id) DO NOTHING;

-- Décisions de fin d'année 2024-2025 : 3 admis, 2 redoublants, 1 exclu
INSERT INTO public.academic_decisions (school_id, enrollment_id, academic_year_id, decision, average) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f1111111-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'admitted', 14.5),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f2222222-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'admitted', 12.0),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f3333333-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'admitted', 15.75),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f4444444-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'repeated', 7.5),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f5555555-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'repeated', 8.0),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f6666666-0000-4372-a567-0e02b2c3d479', 'a1b2c3d4-0000-4372-a567-0e02b2c3d479', 'excluded', 5.0)
ON CONFLICT (school_id, enrollment_id, academic_year_id) DO UPDATE SET decision = excluded.decision, average = excluded.average;




