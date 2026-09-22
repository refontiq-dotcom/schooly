-- Fiche de renseignement : pièces à fournir configurables par établissement.
alter table public.schools
  add column if not exists required_documents jsonb not null default '[]'::jsonb;

update public.schools
set required_documents = '[
  {"id":"acte-naissance","label":"Extrait / acte de naissance","required":true},
  {"id":"photos","label":"Photos d’identité","required":true},
  {"id":"piece-parent","label":"Pièce d’identité du parent / responsable","required":true},
  {"id":"bulletin","label":"Bulletin de notes / dernier relevé","required":false},
  {"id":"certificat-scolarite","label":"Certificat de scolarité","required":false},
  {"id":"certificat-transfert","label":"Certificat de transfert","required":false},
  {"id":"certificat-medical","label":"Certificat médical","required":false}
]'::jsonb
where required_documents = '[]'::jsonb;
