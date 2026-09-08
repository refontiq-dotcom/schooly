-- ============================================================================
-- SCHOOLY v2 — Données de démonstration (idempotent)
-- ============================================================================

insert into establishments (id, name, description, city, address, school_type, reservation_fee_amount)
select '00000000-0000-0000-0000-000000000001',
       'Groupe Scolaire Les Palmiers',
       'École primaire et maternelle à Abidjan.',
       'Abidjan',
       'Cocody, Rue des Jardins',
       'primaire',
       5000
where not exists (select 1 from establishments where id = '00000000-0000-0000-0000-000000000001');

insert into levels (id, establishment_id, name, capacity)
select v.id, '00000000-0000-0000-0000-000000000001', v.name, v.capacity
from (values
  ('00000000-0000-0000-0000-000000000011', 'CP1', 60),
  ('00000000-0000-0000-0000-000000000012', 'CP2', 60),
  ('00000000-0000-0000-0000-000000000013', 'CE1', 60)
) as v(id, name, capacity)
where not exists (select 1 from levels where id = v.id);

insert into sections (id, level_id, name, capacity)
select v.id, v.level_id, v.name, v.capacity
from (values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 'CP1-A', 30),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011', 'CP1-B', 30),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000012', 'CP2-A', 30)
) as v(id, level_id, name, capacity)
where not exists (select 1 from sections where id = v.id);

insert into students (id, establishment_id, section_id, full_name, birthdate, parent_full_name, parent_phone, parent_email)
select v.id, '00000000-0000-0000-0000-000000000001', v.section_id, v.full_name, v.birthdate, v.parent_full_name, v.parent_phone, v.parent_email
from (values
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021', 'Aya Kouassi', '2019-03-12'::date, 'Marie Kouassi', '+2250700000001', 'marie.kouassi@example.com'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000023', 'Yao Traoré', '2018-07-25'::date, 'Ibrahim Traoré', '+2250700000002', null)
) as v(id, section_id, full_name, birthdate, parent_full_name, parent_phone, parent_email)
where not exists (select 1 from students where id = v.id);
