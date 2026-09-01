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
do $$ begin
  create type user_role as enum (
    'admin',
    'professeur',
    'secretariat',
    'censeur',
    'parent'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role user_role not null,
  establishment_id uuid references establishments(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists email text;
create index if not exists idx_profiles_email on profiles (lower(email));

-- Invitations staff : un rôle autre que parent ne s'obtient que par invitation
create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  email text not null,
  role user_role not null,
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  constraint staff_invitations_role_chk check (role in ('professeur', 'secretariat', 'censeur', 'admin'))
);

create unique index if not exists idx_staff_invitations_token on staff_invitations(token);
create unique index if not exists idx_staff_invitations_pending
  on staff_invitations (establishment_id, lower(email))
  where accepted_at is null;

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
do $$ begin
  create type reservation_status as enum (
    'pending_payment',
    'reserved',
    'confirmed',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

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

drop policy if exists "Établissements visibles publiquement" on establishments;
create policy "Établissements visibles publiquement"
  on establishments for select using (true);

drop policy if exists "Niveaux et sections visibles publiquement" on levels;
create policy "Niveaux et sections visibles publiquement"
  on levels for select using (true);

drop policy if exists "Sections visibles publiquement" on sections;
create policy "Sections visibles publiquement"
  on sections for select using (true);

drop policy if exists "Un utilisateur voit son profil" on profiles;
create policy "Un utilisateur voit son profil"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Staff accède aux données de son établissement (profiles)" on profiles;
create policy "Staff accède aux données de son établissement (profiles)"
  on profiles for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

drop policy if exists "Admin gère les niveaux de son établissement" on levels;
create policy "Admin gère les niveaux de son établissement"
  on levels for all using (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admin gère les sections de son établissement" on sections;
create policy "Admin gère les sections de son établissement"
  on sections for all using (
    level_id in (
      select l.id from levels l
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Professeur voit ses sections assignées" on sections;
create policy "Professeur voit ses sections assignées"
  on sections for select using (
    id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

drop policy if exists "Professeur voit ses affectations" on teacher_assignments;
create policy "Professeur voit ses affectations"
  on teacher_assignments for select
  using (teacher_id = auth.uid());

drop policy if exists "Admin gère les affectations de son établissement" on teacher_assignments;
create policy "Admin gère les affectations de son établissement"
  on teacher_assignments for all
  using (
    section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Staff établissement voit les réservations" on reservations;
create policy "Staff établissement voit les réservations"
  on reservations for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

drop policy if exists "Professeur gère les présences de ses sections" on attendance_records;
create policy "Professeur gère les présences de ses sections"
  on attendance_records for all using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

drop policy if exists "Professeur gère les notes de ses sections" on grades;
create policy "Professeur gère les notes de ses sections"
  on grades for all using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
  );

drop policy if exists "Parent voit son enfant" on students;
create policy "Parent voit son enfant"
  on students for select using (
    parent_id = auth.uid()
  );

drop policy if exists "Staff établissement voit les élèves" on students;
create policy "Staff établissement voit les élèves"
  on students for select using (
    establishment_id in (select establishment_id from profiles where id = auth.uid())
  );

drop policy if exists "Parent voit les présences de son enfant" on attendance_records;
create policy "Parent voit les présences de son enfant"
  on attendance_records for select using (
    student_id in (select id from students where parent_id = auth.uid())
  );

drop policy if exists "Parent voit les notes de son enfant" on grades;
create policy "Parent voit les notes de son enfant"
  on grades for select using (
    student_id in (select id from students where parent_id = auth.uid())
  );

drop policy if exists "Création publique de réservation" on reservations;
create policy "Création publique de réservation"
  on reservations for insert
  with check (status = 'pending_payment');

drop policy if exists "Un utilisateur met à jour son nom et téléphone" on profiles;
create policy "Un utilisateur met à jour son nom et téléphone"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admin met à jour son établissement" on establishments;
create policy "Admin met à jour son établissement"
  on establishments for update
  using (
    id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- 12. AUTH : synchronisation profiles, garde des rôles, invitations staff
-- ----------------------------------------------------------------------------
-- L'inscription publique crée toujours un profil `parent`. Le rôle `admin`
-- s'obtient uniquement en créant un établissement. Les autres rôles staff
-- s'obtiennent uniquement via invitation.

create or replace function profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.establishment_id is distinct from old.establishment_id
       or new.email is distinct from old.email then
      -- Les clients PostgREST (authenticated/anon) ne peuvent pas changer ces champs.
      -- Les fonctions SECURITY DEFINER (owner postgres) le peuvent.
      if current_user in ('authenticated', 'anon') then
        raise exception 'Modification du rôle, de l''email ou de l''établissement interdite';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on profiles;
create trigger profiles_guard_trg
  before update on profiles
  for each row execute procedure profiles_guard();

create or replace function link_parent_to_students(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update students s
  set parent_id = p_user_id
  from reservations r, profiles p
  where s.reservation_id = r.id
    and s.parent_id is null
    and p.id = p_user_id
    and p.role = 'parent'
    and (
      (r.parent_email is not null and p.email is not null and lower(r.parent_email) = lower(p.email))
      or (r.parent_phone is not null and p.phone is not null and r.parent_phone = p.phone)
    );
end;
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'Utilisateur'
  );

  insert into public.profiles (id, full_name, phone, email, role, establishment_id)
  values (
    new.id,
    v_name,
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    new.email,
    'parent',
    null
  )
  on conflict (id) do nothing;

  perform public.link_parent_to_students(new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function ensure_own_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_email text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile is null then
    select email,
           coalesce(
             nullif(trim(raw_user_meta_data->>'full_name'), ''),
             nullif(trim(raw_user_meta_data->>'name'), ''),
             split_part(email, '@', 1),
             'Utilisateur'
           )
      into v_email, v_name
      from auth.users
     where id = auth.uid();

    insert into public.profiles (id, full_name, email, role)
    values (auth.uid(), coalesce(v_name, 'Utilisateur'), v_email, 'parent')
    returning * into v_profile;
  else
    update public.profiles
      set email = (select email from auth.users where id = auth.uid())
      where id = auth.uid()
        and (email is null or email is distinct from (select email from auth.users where id = auth.uid()));
  end if;

  perform public.link_parent_to_students(auth.uid());

  select * into v_profile from public.profiles where id = auth.uid();
  return v_profile;
end;
$$;

create or replace function create_establishment_as_admin(
  p_name text,
  p_city text,
  p_address text default null,
  p_description text default null
) returns public.establishments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_est public.establishments;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Profil introuvable';
  end if;

  if v_profile.role <> 'parent' or v_profile.establishment_id is not null then
    raise exception 'Seul un compte parent sans établissement peut en créer un. Le personnel est invité par un administrateur.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 or p_city is null or length(trim(p_city)) = 0 then
    raise exception 'Le nom et la ville de l''établissement sont requis';
  end if;

  insert into public.establishments (name, city, address, description, created_by)
  values (trim(p_name), trim(p_city), nullif(trim(p_address), ''), nullif(trim(p_description), ''), auth.uid())
  returning * into v_est;

  update public.profiles
    set role = 'admin',
        establishment_id = v_est.id
    where id = auth.uid();

  return v_est;
end;
$$;

alter table staff_invitations enable row level security;

drop policy if exists "Admin gère les invitations de son établissement" on staff_invitations;
create policy "Admin gère les invitations de son établissement"
  on staff_invitations for all
  using (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    establishment_id in (
      select establishment_id from profiles where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Destinataire voit son invitation" on staff_invitations;
create policy "Destinataire voit son invitation"
  on staff_invitations for select
  using (
    lower(email) = lower((select email from profiles where id = auth.uid()))
  );

create or replace function accept_staff_invitation(p_token uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.staff_invitations;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Profil introuvable';
  end if;

  select * into v_invite
  from public.staff_invitations
  where token = p_token
  for update;

  if v_invite is null then
    raise exception 'Invitation introuvable';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Invitation déjà utilisée';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invitation expirée';
  end if;

  if v_profile.email is null or lower(v_profile.email) <> lower(v_invite.email) then
    raise exception 'Cette invitation est destinée à une autre adresse email';
  end if;

  if v_profile.role <> 'parent' then
    raise exception 'Ce compte a déjà un rôle staff';
  end if;

  update public.profiles
    set role = v_invite.role,
        establishment_id = v_invite.establishment_id
    where id = auth.uid()
    returning * into v_profile;

  update public.staff_invitations
    set accepted_at = now()
    where id = v_invite.id;

  return v_profile;
end;
$$;

create or replace function finalize_reservation(p_reservation_id uuid)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations;
  v_profile public.profiles;
  v_parent_id uuid;
  v_student public.students;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or v_profile.role not in ('admin', 'secretariat', 'censeur') then
    raise exception 'Accès refusé';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if v_reservation is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_profile.establishment_id is distinct from v_reservation.establishment_id then
    raise exception 'Cette réservation n''appartient pas à votre établissement';
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'La réservation n''est pas en statut réservé (statut: %)', v_reservation.status;
  end if;

  if v_reservation.section_id is null then
    raise exception 'Aucune section assignée';
  end if;

  select * into v_student from public.students where reservation_id = p_reservation_id;
  if v_student is not null then
    if v_reservation.status = 'reserved' then
      update public.reservations
        set status = 'confirmed',
            confirmed_at = now(),
            confirmed_by = auth.uid()
        where id = p_reservation_id;
    end if;
    return v_student;
  end if;

  select p.id into v_parent_id
  from public.profiles p
  where p.role = 'parent'
    and (
      (v_reservation.parent_email is not null and p.email is not null and lower(p.email) = lower(v_reservation.parent_email))
      or (v_reservation.parent_phone is not null and p.phone is not null and p.phone = v_reservation.parent_phone)
    )
  limit 1;

  insert into public.students (
    reservation_id, establishment_id, section_id, full_name, birthdate, parent_id, parent_phone
  ) values (
    v_reservation.id,
    v_reservation.establishment_id,
    v_reservation.section_id,
    v_reservation.student_full_name,
    v_reservation.student_birthdate,
    v_parent_id,
    v_reservation.parent_phone
  )
  returning * into v_student;

  update public.reservations
    set status = 'confirmed',
        confirmed_at = now(),
        confirmed_by = auth.uid()
    where id = p_reservation_id;

  return v_student;
end;
$$;

drop function if exists public.apply_pending_invitation(uuid);

revoke all on function public.link_parent_to_students(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.profiles_guard() from public, anon, authenticated;

revoke all on function public.ensure_own_profile() from public, anon;
revoke all on function public.create_establishment_as_admin(text, text, text, text) from public, anon;
revoke all on function public.accept_staff_invitation(uuid) from public, anon;
revoke all on function public.finalize_reservation(uuid) from public, anon;

grant execute on function public.ensure_own_profile() to authenticated;
grant execute on function public.create_establishment_as_admin(text, text, text, text) to authenticated;
grant execute on function public.accept_staff_invitation(uuid) to authenticated;
grant execute on function public.finalize_reservation(uuid) to authenticated;

grant select, insert, update, delete on table public.staff_invitations to authenticated;

create unique index if not exists idx_students_reservation
  on students (reservation_id)
  where reservation_id is not null;
