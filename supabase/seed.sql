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
