-- ============================================================================
-- SCHOOLY — Données de démonstration
-- À exécuter après schema.sql pour tester l'application immédiatement.
-- ============================================================================

insert into establishments (id, name, description, city, address, latitude, longitude, website_url, reservation_fee_amount, reservation_hold_hours)
values (
  '00000000-0000-0000-0000-000000000001',
  'Groupe Scolaire Les Lauréats',
  'Établissement privé laïc proposant un enseignement du CP à la Terminale, avec un accompagnement personnalisé et des infrastructures modernes.',
  'Abidjan — Yopougon',
  'Rue des Jardins, Yopougon Selmer',
  5.345,
  -4.075,
  'https://example.com',
  5000,
  72
);

insert into levels (id, establishment_id, name, rank) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '6ème', 1),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '5ème', 2);

insert into sections (id, level_id, name, capacity, seats_taken) values
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000101', '6ème1', 30, 4),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000101', '6ème2', 30, 0),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000102', '5ème1', 30, 2);

-- Quelques élèves de démonstration déjà finalisés (section 6ème1)
insert into students (id, establishment_id, section_id, full_name, birthdate, parent_phone) values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'Aïcha Koné', '2013-04-12', '+2250700000001'),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'Junior Bamba', '2013-09-02', '+2250700000002');

-- ============================================================================
-- MODULE OPÉRATIONS (rentrée, paiements, documents)
-- Nécessite : migration-operations.sql (enums fee_status, document_type…)
-- ============================================================================

-- Type d'établissement (6ème/5ème → collège)
update establishments set school_type = 'college'
  where id = '00000000-0000-0000-0000-000000000001';

-- Frais scolaires (catégories)
insert into fee_categories (id, establishment_id, name, description, amount, due_date, school_year, is_optional) values
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000001', 'Frais d''inscription', 'Frais annuels d''inscription', 25000, '2026-09-30', '2026-2027', false),
  ('00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000000001', 'Cantine', 'Restauration scolaire (trimestre)', 45000, '2026-10-15', '2026-2027', false),
  ('00000000-0000-0000-0000-000000003003', '00000000-0000-0000-0000-000000000001', 'Tenue sportive', 'Ensemble complet EPS', 8000, '2026-10-31', '2026-2027', true);

-- Frais par élève (statuts cohérents avec amount_paid)
insert into student_fees (id, student_id, fee_category_id, establishment_id, amount, amount_paid, due_date, status) values
  ('00000000-0000-0000-0000-000000003101', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000001', 25000, 25000, '2026-09-30', 'paid'),
  ('00000000-0000-0000-0000-000000003102', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000000001', 45000, 15000, '2026-10-15', 'partial'),
  ('00000000-0000-0000-0000-000000003103', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003003', '00000000-0000-0000-0000-000000000001',  8000,     0, '2026-10-31', 'pending'),
  ('00000000-0000-0000-0000-000000003104', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000001', 25000, 10000, '2026-09-30', 'partial'),
  ('00000000-0000-0000-0000-000000003105', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000000001', 45000,     0, '2026-10-15', 'pending'),
  ('00000000-0000-0000-0000-000000003106', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003003', '00000000-0000-0000-0000-000000000001',  8000,     0, '2026-10-31', 'pending');

-- Paiements (confirmés)
insert into payments (id, student_id, student_fee_id, establishment_id, amount, method, reference, status, paid_at) values
  ('00000000-0000-0000-0000-000000003201', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003101', '00000000-0000-0000-0000-000000000001', 25000, 'orange_money', 'OM-DEMO-0001', 'confirmed', now()),
  ('00000000-0000-0000-0000-000000003202', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000003102', '00000000-0000-0000-0000-000000000001', 15000, 'wave',         'WV-DEMO-0002', 'confirmed', now()),
  ('00000000-0000-0000-0000-000000003203', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000003104', '00000000-0000-0000-0000-000000000001', 10000, 'mtn_momo',     'MT-DEMO-0003', 'confirmed', now());

-- Liste de fournitures 6ème
insert into supply_lists (id, establishment_id, level_id, school_year, title, notes, published) values
  ('00000000-0000-0000-0000-000000003301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '2026-2027', 'Liste de fournitures 6ème', 'Marquer chaque article au nom de l''élève.', true);

insert into supply_items (id, list_id, name, quantity, estimated_cost, is_optional, sort_order) values
  ('00000000-0000-0000-0000-000000003311', '00000000-0000-0000-0000-000000003301', 'Stylos bleus',     '10', 1500, false, 0),
  ('00000000-0000-0000-0000-000000003312', '00000000-0000-0000-0000-000000003301', 'Cahiers 200 pages', '8', 4000, false, 1),
  ('00000000-0000-0000-0000-000000003313', '00000000-0000-0000-0000-000000003301', 'Kit de géométrie',  '1', 2500, false, 2),
  ('00000000-0000-0000-0000-000000003314', '00000000-0000-0000-0000-000000003301', 'Sac à dos',         '1', 8000, true,  3),
  ('00000000-0000-0000-0000-000000003315', '00000000-0000-0000-0000-000000003301', 'Blouse de travaux', '1', 3500, false, 4);

-- Cases à cocher fournitures (Aïcha a tout acheté, Junior seulement les stylos)
insert into student_supply_checks (student_id, supply_item_id, purchased)
  select '00000000-0000-0000-0000-000000002001', id, true from supply_items where list_id = '00000000-0000-0000-0000-000000003301';
insert into student_supply_checks (student_id, supply_item_id, purchased)
  select '00000000-0000-0000-0000-000000002002', id, (sort_order = 0) from supply_items where list_id = '00000000-0000-0000-0000-000000003301';

-- Documents exigés (statuts de rentrée)
insert into student_documents (student_id, establishment_id, doc_type, status, submitted_at) values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', 'acte_naissance',     'submitted', now()),
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', 'photo_identite',     'missing',   null),
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', 'carnet_vaccination', 'missing',   null),
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', 'bulletin_precedent', 'submitted', now()),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', 'acte_naissance',     'submitted', now()),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', 'photo_identite',     'missing',   null),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', 'carnet_vaccination', 'missing',   null),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', 'bulletin_precedent', 'missing',   null);

-- ============================================================================
-- MODULE INTERNAT
-- Nécessite : migrations/20260902180000_internat_module.sql
-- ============================================================================

-- Bâtiments + chambres + lits
insert into internat_blocks (id, establishment_id, name, gender, capacity) values
  ('00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000000001', 'Bloc A — Filles',  'fille',  24),
  ('00000000-0000-0000-0000-000000004002', '00000000-0000-0000-0000-000000000001', 'Bloc B — Garçons', 'garcon', 24);

insert into internat_rooms (id, block_id, number, bed_count, status) values
  ('00000000-0000-0000-0000-000000004101', '00000000-0000-0000-0000-000000004001', 'A-101', 4, 'disponible'),
  ('00000000-0000-0000-0000-000000004102', '00000000-0000-0000-0000-000000004002', 'B-101', 4, 'disponible');

insert into internat_beds (id, room_id, bed_number, status) values
  ('00000000-0000-0000-0000-000000004201', '00000000-0000-0000-0000-000000004101', 1, 'occupe'),
  ('00000000-0000-0000-0000-000000004202', '00000000-0000-0000-0000-000000004101', 2, 'libre'),
  ('00000000-0000-0000-0000-000000004203', '00000000-0000-0000-0000-000000004101', 3, 'libre'),
  ('00000000-0000-0000-0000-000000004204', '00000000-0000-0000-0000-000000004101', 4, 'libre'),
  ('00000000-0000-0000-0000-000000004211', '00000000-0000-0000-0000-000000004102', 1, 'occupe'),
  ('00000000-0000-0000-0000-000000004212', '00000000-0000-0000-0000-000000004102', 2, 'libre'),
  ('00000000-0000-0000-0000-000000004213', '00000000-0000-0000-0000-000000004102', 3, 'libre'),
  ('00000000-0000-0000-0000-000000004214', '00000000-0000-0000-0000-000000004102', 4, 'libre');

-- Affectations internat
insert into internat_assignments (id, student_id, bed_id, academic_year, start_date, status) values
  ('00000000-0000-0000-0000-000000004301', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000004201', '2026-2027', current_date, 'actif'),
  ('00000000-0000-0000-0000-000000004302', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000004211', '2026-2027', current_date, 'actif');

-- Appels du soir (Aïcha présente, Junior en retard)
insert into internat_roll_calls (id, block_id, roll_call_date, roll_call_type) values
  ('00000000-0000-0000-0000-000000004311', '00000000-0000-0000-0000-000000004001', current_date, 'soir'),
  ('00000000-0000-0000-0000-000000004312', '00000000-0000-0000-0000-000000004002', current_date, 'soir');

insert into internat_roll_items (id, roll_call_id, student_id, present, note, late_minutes) values
  ('00000000-0000-0000-0000-000000004321', '00000000-0000-0000-0000-000000004311', '00000000-0000-0000-0000-000000002001', true,  null,              0),
  ('00000000-0000-0000-0000-000000004322', '00000000-0000-0000-0000-000000004312', '00000000-0000-0000-0000-000000002002', false, 'Rentrée tardive', 15);

-- Repas du jour + présences
insert into internat_meals (id, establishment_id, meal_date, meal_type, meal_name) values
  ('00000000-0000-0000-0000-000000004401', '00000000-0000-0000-0000-000000000001', current_date, 'dejeuner', 'Riz poulet sauce arachide');

insert into internat_meal_attendance (meal_id, student_id, present)
  select '00000000-0000-0000-0000-000000004401', id, true from students
  where id in ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002002');

-- Incident mineur + visite parentale + suivi santé
insert into internat_incidents (id, establishment_id, student_id, incident_date, severity, category, title, description) values
  ('00000000-0000-0000-0000-000000004501', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002002', current_date, 'mineur', 'discipline', 'Bavardage après l''extinction des feux', 'Rappel du règlement effectué.');

insert into internat_visits (id, student_id, visitor_name, visitor_phone, relationship, visit_date, arrive_at) values
  ('00000000-0000-0000-0000-000000004601', '00000000-0000-0000-0000-000000002001', 'Mme Koné', '+2250700000001', 'Mère', current_date, now());

insert into internat_health (id, student_id, check_date, temperature, weight, symptoms, medication) values
  ('00000000-0000-0000-0000-000000004701', '00000000-0000-0000-0000-000000002001', current_date, 36.8, 38.5, null, null);

-- ============================================================================
-- NON SEEDABLE (nécessitent des comptes auth réels) :
--   messages, behavior_notes, attendance_records, grades
--   → recorded_by / sender_id référencent profiles(id) = auth.users(id)
--     avec NOT NULL. Ces données se créent via l'application.
-- ============================================================================
