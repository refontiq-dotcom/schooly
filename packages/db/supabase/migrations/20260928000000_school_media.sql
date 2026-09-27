-- ============================================================================
-- Schooly — médias d'établissement (photos classiques et panoramas 360°).
--
-- PÉRIMÈTRE VOLONTAIREMENT RESTREINT : cette table sert aujourd'hui
-- UNIQUEMENT au flux 360°. Les photos classiques continuent de vivre dans
-- `schools.cover_photo_url` et `schools.gallery_photos`, qui font tourner des
-- fonctionnalités existantes (fiche publique, export, synchronisation
-- Trouvetou). Ne pas les migrer ici sans une migration dédiée et un audit de
-- régression : ce serait dupliquer l'existant pour un gain nul.
--
-- `kind` existe dès maintenant pour que le modèle distingue une photo
-- classique d'un panorama, sans obliger à une seconde migration le jour où
-- `kind = 'photo'` servings enfin.
-- ============================================================================

create table if not exists public.school_media (
  id uuid primary key default gen_random_uuid(),

  -- Porteur du média. `on delete cascade` : une école supprimée emporte ses
  -- médias, sinon on laisserait des lignes orphelines et des objets R2 introuvables.
  school_id uuid not null references public.schools(id) on delete cascade,

  -- Chambre concernée, le cas échéant. Nul aujourd'hui : les chambres
  -- (dorm_rooms) n'ont de visite 360° nulle part dans l'application, et aucune
  -- interface ne le renseigne. La colonne existe pour que le modèle tienne
  -- sans refonte le jour où une visite sera attachée à une chambre, et pour
  -- que la synchronisation Trouvetou sache à quel parent rattacher le média.
  --
  -- La clé étrangère porte sur le COUPLE (room_id, school_id), pas sur
  -- `room_id` seul. Avec une FK simple, PostgreSQL ne vérifie que
  -- l'EXISTENCE de la chambre : rattacher la chambre d'une autre école passe,
  -- et la ligne affirme alors qu'un établissement possède une visite d'un
  -- concurrent. Ce n'était pas théorique — c'était vérifié sur la base locale
  -- avant de poser la contrainte ci-dessous.
  room_id uuid,

  -- 'photo'      : photo classique (non utilisé à ce jour, voir en-tête)
  -- 'panorama_360': visite 360° équirectangulaire 2:1
  kind text not null default 'panorama_360'
    check (kind in ('photo', 'panorama_360')),

  -- Clé de l'objet dans le bucket R2. `unique` : une clé = un objet, et le
  -- stockage ne se dédouble pas. C'est cette clé, et non l'URL publique, que
  -- la suppression utilise — l'URL pourra changer de domaine.
  r2_key text not null unique,
  public_url text not null,

  content_type text not null,
  byte_size bigint check (byte_size is null or byte_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),

  -- Machine à états.
  --   uploaded   : le fichier est dans R2, contrôle pas encore passé
  --   validated  : contrôles qualitatifs passés (ratio, résolution, raccord…)
  --   rejected   : contrôle refusé, la raison est conservée
  --   published  : validé ET transmis à Trouvetou
  -- Un rejet est terminal tant que le directeur ne renvoie pas un autre fichier.
  status text not null default 'uploaded'
    check (status in ('uploaded', 'validated', 'rejected', 'published')),

  -- Raison de rejet STRUCTURÉE, pour pouvoir filtrer et compter, plus le
  -- détail lisible en français destiné au directeur. Une simple chaîne libre
  -- ne permettrait ni requête ni agrégation.
  rejection_code text check (
    rejection_code is null or rejection_code in (
      'invalid_mime', 'unreadable_file', 'too_large',
      'invalid_ratio', 'invalid_resolution',
      'torn_seam', 'black_zones'
    )
  ),
  rejection_details text,

  -- Rapport complet du validateur (chaque contrôle, son statut, sa mesure et
  -- son seuil). Conservé même en cas d'acceptation : sans lui, impossible de
  -- savoir pourquoi une photo a été refusée trois mois plus tard.
  validation jsonb,

  validated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Cohérence : `published` est terminal, il faut donc soit un média validé,
  -- soit un média rejeté avec sa raison. Un média publié sans validation ni
  -- rejet n'aurait aucun sens.
  check (status <> 'published' or validated_at is not null)
);

drop trigger if exists trg_school_media_updated_at on public.school_media;
create trigger trg_school_media_updated_at before update on public.school_media
for each row execute function public.touch_updated_at();

create index if not exists idx_school_media_school on public.school_media (school_id);
create index if not exists idx_school_media_room on public.school_media (room_id) where room_id is not null;

-- Un seul panorama « d'établissement » publié à la fois (room_id nul), ce qui
-- reprend la règle métier déjà appliquée par la contrainte
-- schools_trouvetou_photos_360_max_1 sur `schools`. Sans cette contrainte
-- unique, deux uploads quasi simultanés créeraient deux visites publiées et
-- la synchronisation enverrait un tableau ambigu à Trouvetou.
create unique index if not exists uniq_school_media_published_panorama
  on public.school_media (school_id)
  where kind = 'panorama_360' and status = 'published' and room_id is null;

-- Clé étrangère composite, appliquée APRÈS la création de l'index unique
-- qu'elle référence : PostgreSQL exige que la cible existe au moment du ALTER.
--
-- `dorm_rooms(id)` est déjà unique (clé primaire), mais la cible d'une FK
-- composite doit porter une contrainte UNIQUE explicite sur le couple. Cet
-- index coûte presque rien : `id` étant unique, il ne fait que répéter la
-- colonne de tête de la clé primaire.
create unique index if not exists uniq_dorm_rooms_id_school
  on public.dorm_rooms (id, school_id);

alter table public.school_media
  drop constraint if exists school_media_room_id_fkey;

alter table public.school_media
  add constraint school_media_room_school_fkey
  foreign key (room_id, school_id)
  references public.dorm_rooms (id, school_id)
  on delete cascade;

comment on table public.school_media is
  'Médias d''établissement Schooly. Aujourd''hui : panoramas 360° validés. Les photos classiques restent dans schools.cover_photo_url / schools.gallery_photos.';

comment on column public.school_media.status is
  'Cycle de vie : uploaded -> validated | rejected -> published. Un rejet est terminal.';

comment on column public.school_media.r2_key is
  'Clé de l''objet dans le bucket R2. Utilisée par la suppression ; indépendante du domaine public.';