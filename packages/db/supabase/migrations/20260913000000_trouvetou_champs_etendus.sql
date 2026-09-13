-- ============================================================================
-- 20260913000000 — Champs etendus Trouvetou Connector (Phase 10)
-- Contrat standard Refontiq : photos_360, itineraire, grille_tarifaire_publique
-- + video_url (YouTube ou autre) comme demande
-- ============================================================================

alter table public.schools
  add column if not exists description_publique text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists itineraire text,
  add column if not exists photos_360 jsonb default '[]'::jsonb,
  add column if not exists video_url text,
  add column if not exists grille_tarifaire_publique jsonb default '[]'::jsonb;

create index if not exists idx_schools_location on public.schools (latitude, longitude)
  where published_to_trouvetou = true and latitude is not null and longitude is not null;
