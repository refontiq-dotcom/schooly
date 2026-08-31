-- ============================================================================
-- SCHOOLY v1 — Schéma de base de données Supabase (PostgreSQL)
-- ============================================================================
-- Ce script crée les tables, contraintes, fonctions et politiques RLS
-- nécessaires au MVP décrit dans le cahier des charges (Phase 1).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ÉTABLISSEMENTS
-- ----------------------------------------------------------------------------
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text not null,
  address text,
  latitude double precision,
  longitude double precision,
  website_url text,
  cover_image_url text,
  tour_360_url text,
  reservation_fee_amount numeric(12,2) default 0,
  reservation_hold_hours int not null default 72, -- délai avant libération auto (anti no-show)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. PROFILS UTILISATEURS + RÔLES
-- ----------------------------------------------------------------------------
create type user_role as enum (
  'admin',        -- Directeur / Administrateur d'établissement
  'professeur',
  'secretariat',
  'censeur',
  'parent'
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null,
  establishment_id uuid references establishments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. NIVEAUX ET SECTIONS (CLASSES)
-- ----------------------------------------------------------------------------
-- Un "niveau" = 6ème, 5ème, ... Terminale (ou CP1, CP2... selon le cycle)
create table if not exists levels (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,           -- ex: "6ème"
  rank int not null default 0,  -- ordre d'affichage
  created_at timestamptz not null default now(),
  unique (establishment_id, name)
);

-- Une "section" = 6ème1, 6ème2... avec sa capacité propre
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,               -- ex: "6ème1"
  capacity int not null check (capacity > 0),
  seats_taken int not null default 0 check (seats_taken >= 0),
  homeroom_teacher_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (level_id, name),
  check (seats_taken <= capacity)
);

-- Affectation des professeurs aux sections/matières
create table if not exists teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id, subject)
);

-- ----------------------------------------------------------------------------
-- 4. RÉSERVATIONS (Trouvetou)
-- ----------------------------------------------------------------------------
create type reservation_status as enum (
  'pending_payment',
  'reserved',       -- payé, place décomptée, en attente de finalisation
  'confirmed',       -- finalisée sur place -> devient "inscrit"
  'expired',         -- non finalisée dans le délai -> place libérée
  'cancelled'
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id),
  level_id uuid not null references levels(id),
  section_id uuid references sections(id), -- assignée automatiquement ou au moment de la finalisation
  student_full_name text not null,
  student_birthdate date,
  parent_full_name text not null,
  parent_phone text not null,
  parent_email text,
  status reservation_status not null default 'pending_payment',
  amount_paid numeric(12,2) default 0,
  payment_reference text,
  qr_code_token uuid not null default gen_random_uuid(),
  expires_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_establishment on reservations(establishment_id);
create index if not exists idx_reservations_status on reservations(status);
create index if not exists idx_reservations_qr on reservations(qr_code_token);

-- ----------------------------------------------------------------------------
-- 5. ÉLÈVES (une fois l'inscription finalisée)
-- ----------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id),
  establishment_id uuid not null references establishments(id),
  section_id uuid not null references sections(id),
  full_name text not null,
  birthdate date,
  parent_id uuid references profiles(id),
  parent_phone text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. PRÉSENCES
-- ----------------------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id),
  recorded_by uuid not null references profiles(id),
  session_date date not null default current_date,
  present boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, session_date)
);

-- ----------------------------------------------------------------------------
-- 7. NOTES / ÉVALUATIONS
-- ----------------------------------------------------------------------------
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id),
  recorded_by uuid not null references profiles(id),
  subject text not null,
  evaluation_type text not null default 'interrogation', -- interrogation | devoir | composition
  score numeric(5,2) not null,
  max_score numeric(5,2) not null default 20,
  evaluation_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. FONCTION : RÉSERVATION ATOMIQUE (anti-survente)
-- ----------------------------------------------------------------------------
-- Décrémente le quota de la section de façon transactionnelle. À appeler
-- après confirmation du paiement. Retourne la ligne de réservation mise à jour.
create or replace function reserve_seat(
  p_reservation_id uuid
) returns reservations
language plpgsql
as $$
declare
  v_reservation reservations;
  v_section sections;
begin
  select * into v_reservation from reservations where id = p_reservation_id for update;

  if v_reservation is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.status <> 'pending_payment' then
    raise exception 'Réservation déjà traitée (statut: %)', v_reservation.status;
  end if;

  if v_reservation.section_id is null then
    raise exception 'Aucune section assignée à cette réservation';
  end if;

  -- Verrou de ligne sur la section pour empêcher la survente en cas de concurrence
  select * into v_section from sections where id = v_reservation.section_id for update;

  if v_section.seats_taken >= v_section.capacity then
    update reservations set status = 'cancelled' where id = p_reservation_id;
    raise exception 'Plus de place disponible dans cette section';
  end if;

  update sections set seats_taken = seats_taken + 1 where id = v_section.id;

  update reservations
    set status = 'reserved',
        expires_at = now() + (
          select (reservation_hold_hours || ' hours')::interval
          from establishments where id = v_reservation.establishment_id
        )
    where id = p_reservation_id
    returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. FONCTION : LIBÉRATION DES RÉSERVATIONS EXPIRÉES (anti no-show)
-- ----------------------------------------------------------------------------
-- À exécuter périodiquement (cron Supabase / n8n) pour libérer les places
-- des réservations non finalisées dans le délai imparti.
create or replace function release_expired_reservations() returns int
language plpgsql
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id, section_id from reservations
    where status = 'reserved' and expires_at is not null and expires_at < now()
  loop
    update sections set seats_taken = greatest(seats_taken - 1, 0) where id = r.section_id;
    update reservations set status = 'expired' where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. VUE : PLACES DISPONIBLES PAR NIVEAU (pour affichage Trouvetou)
-- ----------------------------------------------------------------------------
create or replace view level_availability as
select
  l.id as level_id,
  l.establishment_id,
  l.name as level_name,
  coalesce(sum(s.capacity), 0) as total_capacity,
  coalesce(sum(s.seats_taken), 0) as total_taken,
  coalesce(sum(s.capacity - s.seats_taken), 0) as seats_available
from levels l
left join sections s on s.level_id = l.id
group by l.id, l.establishment_id, l.name;

-- ----------------------------------------------------------------------------
-- 11. RLS (Row Level Security)
-- ----------------------------------------------------------------------------
alter table establishments enable row level security;
alter table profiles enable row level security;
alter table levels enable row level security;
alter table sections enable row level security;
alter table teacher_assignments enable row level security;
alter table reservations enable row level security;
alter table students enable row level security;
alter table attendance_records enable row level security;
alter table grades enable row level security;

-- Lecture publique des établissements et de la disponibilité (vitrine Trouvetou)
create policy "Établissements visibles publiquement"
  on establishments for select using (true);

create policy "Niveaux et sections visibles publiquement"
  on levels for select using (true);

create policy "Sections visibles publiquement"
  on sections for select using (true);

-- Un utilisateur voit son propre profil
create policy "Un utilisateur voit son profil"
  on profiles for select using (auth.uid() = id);

-- Admin/secrétariat/censeur/professeur : accès limité à leur établissement
create policy "Staff accède aux données de son établissement (profiles)"
  on profiles for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

create policy "Admin gère les niveaux de son établissement"
  on levels for all using (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admin gère les sections de son établissement"
  on sections for all using (
    level_id in (
      select l.id from levels l
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Professeur voit ses sections assignées"
  on sections for select using (
    id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

create policy "Staff établissement voit les réservations"
  on reservations for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

create policy "Professeur gère les présences de ses sections"
  on attendance_records for all using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

create policy "Professeur gère les notes de ses sections"
  on grades for all using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

create policy "Parent voit son enfant"
  on students for select using (
    parent_id = auth.uid()
  );

create policy "Staff établissement voit les élèves"
  on students for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

create policy "Parent voit les présences de son enfant"
  on attendance_records for select using (
    student_id in (select id from students where parent_id = auth.uid())
  );

create policy "Parent voit les notes de son enfant"
  on grades for select using (
    student_id in (select id from students where parent_id = auth.uid())
  );
