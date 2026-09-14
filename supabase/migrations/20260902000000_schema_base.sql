-- ============================================================================
-- SCHOOLY — Schéma de base auto-contenu (flux CLI)
--
-- Fusion ordonnée de : schema.sql → migration-auth-roles.sql →
-- migration-operations.sql → apply-batch-2.sql (ordre de setup-local-db.sh).
-- Rend `supabase start` / `db push` / `db reset` capables d appliquer tout le
-- schéma sans dépendre de fichiers hors du dossier migrations/.
-- Idempotent : IF NOT EXISTS / ON CONFLICT / exceptions duplicate_object.
-- ============================================================================

-- ============================================================================
-- SCHOOLY v1 — Schéma de base de données Supabase (PostgreSQL)
-- ============================================================================
-- Ce script crée les tables, contraintes, fonctions et politiques RLS
-- nécessaires au MVP décrit dans le cahier des charges (Phase 1).
-- ============================================================================

create extension if not exists "pgcrypto";

-- Enum du type d'établissement (5 types supportés)
do $$ begin
  create type school_type as enum (
    'primaire',
    'college',
    'lycee',
    'professionnel',
    'islamique'
  );
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 1. ÉTABLISSEMENTS
-- ----------------------------------------------------------------------------
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text not null,
  address text,
  school_type school_type,
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
  expires_at timestamptz not null default (now() + make_interval(days => 7)),
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
    'cancelled',
    'waitlisted',
    'rejected_fraud'
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

-- Helper RLS : lit le profil de l'utilisateur courant sans déclencher la RLS
-- de `profiles` (security definer). À utiliser dans les policies à la place des
-- sous-requêtes auto-référentes sur `profiles` (récursion infinie garantie).
create or replace function public.my_profile()
returns table (id uuid, establishment_id uuid, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.establishment_id, p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

drop policy if exists "Un utilisateur voit son profil" on profiles;
create policy "Un utilisateur voit son profil"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Staff accède aux données de son établissement (profiles)" on profiles;
create policy "Staff accède aux données de son établissement (profiles)"
  on profiles for select using (
    establishment_id in (
      select mp.establishment_id
      from public.my_profile() mp
      where mp.role in ('admin', 'censeur', 'secretariat', 'professeur')
    )
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
  p_description text default null,
  p_school_type school_type default null
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

  insert into public.establishments (name, city, address, description, school_type, created_by)
  values (trim(p_name), trim(p_city), nullif(trim(p_address), ''), nullif(trim(p_description), ''), p_school_type, auth.uid())
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
-- Privilèges : la RLS filtre les lignes, les GRANT ouvrent l'accès aux objets.
-- Sans eux : erreur 42501 "permission denied for table …" sur toutes les tables.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on function public.my_profile() to anon, authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.profiles_guard() from public, anon, authenticated;

revoke all on function public.ensure_own_profile() from public, anon;
revoke all on function public.create_establishment_as_admin(text, text, text, text, school_type) from public, anon;
revoke all on function public.accept_staff_invitation(uuid) from public, anon;
revoke all on function public.finalize_reservation(uuid) from public, anon;

grant execute on function public.ensure_own_profile() to authenticated;
grant execute on function public.create_establishment_as_admin(text, text, text, text, school_type) to authenticated;
grant execute on function public.accept_staff_invitation(uuid) to authenticated;
grant execute on function public.finalize_reservation(uuid) to authenticated;

grant select, insert, update, delete on table public.staff_invitations to authenticated;

create unique index if not exists idx_students_reservation
  on students (reservation_id)
  where reservation_id is not null;


-- ============================================================================
-- SCHOOLY — Migration auth / rôles (à coller dans SQL Editor Supabase)
-- Idempotent : peut être relancé sur une base déjà migrée.
-- ============================================================================

-- 1. Colonne email sur profiles
alter table profiles add column if not exists email text;
create index if not exists idx_profiles_email on profiles (lower(email));

-- 2. Invitations staff
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

create unique index if not exists idx_students_reservation
  on students (reservation_id)
  where reservation_id is not null;

-- 3. Policies complémentaires
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

-- 4. Garde : un client ne peut pas changer role / establishment_id / email
create or replace function profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.establishment_id is distinct from old.establishment_id
       or new.email is distinct from old.email then
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

-- 5. Rattachement parent ↔ élève (email ou téléphone)
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

-- 6. Tout nouvel utilisateur Auth → profil parent
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

-- 7. Filet de sécurité pour les comptes déjà existants
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

-- 8. Devenir admin en créant un établissement
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

-- 9. RLS invitations
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

-- 10. Accepter une invitation (lien /auth/invitation?token=)
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

-- 11. Finaliser une inscription (secrétariat) + rattacher le parent
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

-- 12. Droits
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


-- ============================================================================
-- SCHOOLY — Partie 3 : Rentrée, paiements, documents, messages, comportement
-- Coller d'un coup dans l'éditeur SQL Supabase (après Partie 1 et 2).
-- ============================================================================

do $$ begin
  create type fee_status as enum ('pending', 'partial', 'paid', 'overdue');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('orange_money', 'mtn_momo', 'moov', 'wave', 'cash', 'bank');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('pending', 'confirmed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_type as enum (
    'acte_naissance',
    'photo_identite',
    'carnet_vaccination',
    'bulletin_precedent',
    'certificat_scolarite',
    'piece_identite',
    'dossier_examen',
    'autre'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_status as enum ('missing', 'submitted', 'validated', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type behavior_kind as enum ('positif', 'a_surveiller', 'incident');
exception when duplicate_object then null;
end $$;

create table if not exists fee_categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  description text,
  amount numeric(12,2) not null default 0,
  due_date date,
  school_year text not null default '2026-2027',
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (establishment_id, name, school_year)
);

create table if not exists student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status fee_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (student_id, fee_category_id),
  check (amount_paid >= 0),
  check (amount_paid <= amount + 0.01)
);

create index if not exists idx_student_fees_student on student_fees(student_id);
create index if not exists idx_student_fees_etab on student_fees(establishment_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  student_fee_id uuid references student_fees(id) on delete set null,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null default 'orange_money',
  reference text,
  status payment_status not null default 'pending',
  paid_at timestamptz,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_payments_etab on payments(establishment_id);

create table if not exists supply_lists (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  level_id uuid not null references levels(id) on delete cascade,
  school_year text not null default '2026-2027',
  title text not null,
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists supply_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references supply_lists(id) on delete cascade,
  name text not null,
  quantity text not null default '1',
  estimated_cost numeric(12,2) not null default 0,
  is_optional boolean not null default false,
  sort_order int not null default 0
);

create table if not exists student_supply_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  supply_item_id uuid not null references supply_items(id) on delete cascade,
  purchased boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, supply_item_id)
);

create table if not exists student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  doc_type document_type not null,
  status document_status not null default 'missing',
  required boolean not null default true,
  alert_from_level text,
  notes text,
  submitted_at timestamptz,
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, doc_type)
);

create index if not exists idx_student_documents_student on student_documents(student_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  recipient_id uuid references profiles(id),
  student_id uuid references students(id) on delete set null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on messages(recipient_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id, created_at desc);

create table if not exists behavior_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  recorded_by uuid not null references profiles(id),
  kind behavior_kind not null default 'a_surveiller',
  title text not null,
  body text,
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_behavior_student on behavior_notes(student_id);

create or replace function refresh_fee_status(p_fee_id uuid)
returns void language plpgsql as $$
declare
  v_fee student_fees;
begin
  select * into v_fee from student_fees where id = p_fee_id for update;
  if v_fee is null then return; end if;
  if v_fee.amount_paid >= v_fee.amount then
    update student_fees set status = 'paid' where id = p_fee_id;
  elsif v_fee.amount_paid > 0 then
    update student_fees set status = 'partial' where id = p_fee_id;
  elsif v_fee.due_date is not null and v_fee.due_date < current_date then
    update student_fees set status = 'overdue' where id = p_fee_id;
  else
    update student_fees set status = 'pending' where id = p_fee_id;
  end if;
end;
$$;

create or replace function record_fee_payment(
  p_student_fee_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_reference text default null,
  p_confirm boolean default false
) returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_fee student_fees;
  v_payment payments;
  v_confirm boolean;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  select * into v_fee from student_fees where id = p_student_fee_id for update;
  if v_fee is null then raise exception 'Echeance introuvable'; end if;

  if v_profile.role = 'parent' then
    if not exists (select 1 from students s where s.id = v_fee.student_id and s.parent_id = auth.uid()) then
      raise exception 'Acces refuse';
    end if;
    v_confirm := false;
  elsif v_profile.role in ('admin', 'secretariat', 'censeur') then
    if v_profile.establishment_id is distinct from v_fee.establishment_id then
      raise exception 'Autre etablissement';
    end if;
    v_confirm := coalesce(p_confirm, true);
  else
    raise exception 'Acces refuse';
  end if;

  insert into payments (
    student_id, student_fee_id, establishment_id, amount, method, reference, status, paid_at, recorded_by
  ) values (
    v_fee.student_id, v_fee.id, v_fee.establishment_id, p_amount, p_method, nullif(trim(p_reference), ''),
    case when v_confirm then 'confirmed' else 'pending' end,
    case when v_confirm then now() else null end,
    auth.uid()
  ) returning * into v_payment;

  if v_confirm then
    update student_fees
      set amount_paid = least(amount, amount_paid + p_amount)
      where id = v_fee.id;
    perform refresh_fee_status(v_fee.id);
  end if;

  return v_payment;
end;
$$;

create or replace function confirm_fee_payment(p_payment_id uuid)
returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_payment payments;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or v_profile.role not in ('admin', 'secretariat', 'censeur') then
    raise exception 'Acces refuse';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Paiement introuvable'; end if;
  if v_profile.establishment_id is distinct from v_payment.establishment_id then
    raise exception 'Autre etablissement';
  end if;
  if v_payment.status = 'confirmed' then return v_payment; end if;

  update payments
    set status = 'confirmed', paid_at = now()
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.student_fee_id is not null then
    update student_fees
      set amount_paid = least(amount, amount_paid + v_payment.amount)
      where id = v_payment.student_fee_id;
    perform refresh_fee_status(v_payment.student_fee_id);
  end if;

  return v_payment;
end;
$$;

create or replace function assign_fees_to_student(p_student_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_student students;
  v_count int := 0;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return 0; end if;

  insert into student_fees (student_id, fee_category_id, establishment_id, amount, due_date)
  select v_student.id, fc.id, fc.establishment_id, fc.amount, fc.due_date
  from fee_categories fc
  where fc.establishment_id = v_student.establishment_id
  on conflict (student_id, fee_category_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function seed_student_documents(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_student students;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return; end if;

  insert into student_documents (student_id, establishment_id, doc_type, required, alert_from_level)
  values
    (v_student.id, v_student.establishment_id, 'acte_naissance', true, null),
    (v_student.id, v_student.establishment_id, 'photo_identite', true, null),
    (v_student.id, v_student.establishment_id, 'carnet_vaccination', true, null),
    (v_student.id, v_student.establishment_id, 'bulletin_precedent', false, null),
    (v_student.id, v_student.establishment_id, 'piece_identite', true, 'CM1'),
    (v_student.id, v_student.establishment_id, 'dossier_examen', true, 'CM2')
  on conflict (student_id, doc_type) do nothing;
end;
$$;

create or replace function after_student_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform seed_student_documents(new.id);
  perform assign_fees_to_student(new.id);
  return new;
end;
$$;

drop trigger if exists after_student_insert_trg on students;
create trigger after_student_insert_trg
  after insert on students
  for each row execute procedure after_student_insert();

create or replace function send_school_message(
  p_recipient_id uuid,
  p_student_id uuid,
  p_subject text,
  p_body text
) returns messages
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_student students;
  v_etab uuid;
  v_msg messages;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_subject is null or length(trim(p_subject)) = 0 or p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Sujet et message requis';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  v_etab := v_profile.establishment_id;

  if p_student_id is not null then
    select * into v_student from students where id = p_student_id;
    if v_student is null then raise exception 'Eleve introuvable'; end if;
    v_etab := v_student.establishment_id;
    if v_profile.role = 'parent' and v_student.parent_id is distinct from auth.uid() then
      raise exception 'Acces refuse';
    end if;
    if v_profile.role <> 'parent' and v_profile.establishment_id is distinct from v_student.establishment_id then
      raise exception 'Acces refuse';
    end if;
  end if;

  if v_etab is null then raise exception 'Etablissement introuvable'; end if;

  if p_recipient_id is null then raise exception 'Destinataire requis'; end if;

  insert into messages (establishment_id, sender_id, recipient_id, student_id, subject, body)
  values (v_etab, auth.uid(), p_recipient_id, p_student_id, trim(p_subject), trim(p_body))
  returning * into v_msg;

  return v_msg;
end;
$$;

alter table fee_categories enable row level security;
alter table student_fees enable row level security;
alter table payments enable row level security;
alter table supply_lists enable row level security;
alter table supply_items enable row level security;
alter table student_supply_checks enable row level security;
alter table student_documents enable row level security;
alter table messages enable row level security;
alter table behavior_notes enable row level security;

drop policy if exists "fees_cat_staff" on fee_categories;
create policy "fees_cat_staff" on fee_categories for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "fees_cat_parent" on fee_categories;
create policy "fees_cat_parent" on fee_categories for select using (
  establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sfees_staff" on student_fees;
create policy "sfees_staff" on student_fees for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "sfees_parent" on student_fees;
create policy "sfees_parent" on student_fees for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "pay_staff" on payments;
create policy "pay_staff" on payments for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid())
);

drop policy if exists "pay_parent" on payments;
create policy "pay_parent" on payments for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "sup_list_staff" on supply_lists;
create policy "sup_list_staff" on supply_lists for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat')));

drop policy if exists "sup_list_parent" on supply_lists;
create policy "sup_list_parent" on supply_lists for select using (
  published = true and establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sup_items_staff" on supply_items;
create policy "sup_items_staff" on supply_items for all
  using (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid())))
  with check (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat'))));

drop policy if exists "sup_items_parent" on supply_items;
create policy "sup_items_parent" on supply_items for select using (
  list_id in (
    select sl.id from supply_lists sl
    where sl.published = true
      and sl.establishment_id in (select establishment_id from students where parent_id = auth.uid())
  )
);

drop policy if exists "sup_check_parent" on student_supply_checks;
create policy "sup_check_parent" on student_supply_checks for all
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "sup_check_staff" on student_supply_checks;
create policy "sup_check_staff" on student_supply_checks for select using (
  student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid()))
);

drop policy if exists "docs_staff" on student_documents;
create policy "docs_staff" on student_documents for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "docs_parent_select" on student_documents;
create policy "docs_parent_select" on student_documents for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "docs_parent_update" on student_documents;
create policy "docs_parent_update" on student_documents for update
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "msg_own" on messages;
create policy "msg_own" on messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

drop policy if exists "msg_own_update" on messages;
create policy "msg_own_update" on messages for update using (
  sender_id = auth.uid() or recipient_id = auth.uid()
)
with check (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "msg_staff_select" on messages;
create policy "msg_staff_select" on messages for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur','professeur'))
);

drop policy if exists "beh_teacher" on behavior_notes;
create policy "beh_teacher" on behavior_notes for all
  using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  )
  with check (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  );

drop policy if exists "beh_parent" on behavior_notes;
create policy "beh_parent" on behavior_notes for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

revoke all on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) from public, anon;
revoke all on function public.confirm_fee_payment(uuid) from public, anon;
revoke all on function public.assign_fees_to_student(uuid) from public, anon;
revoke all on function public.seed_student_documents(uuid) from public, anon;
revoke all on function public.after_student_insert() from public, anon, authenticated;
revoke all on function public.send_school_message(uuid, uuid, text, text) from public, anon;
revoke all on function public.refresh_fee_status(uuid) from public, anon, authenticated;

grant execute on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) to authenticated;
grant execute on function public.confirm_fee_payment(uuid) to authenticated;
grant execute on function public.assign_fees_to_student(uuid) to authenticated;
grant execute on function public.send_school_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.seed_student_documents(uuid) to authenticated;

grant select, insert, update, delete on table public.fee_categories to authenticated;
grant select, insert, update, delete on table public.student_fees to authenticated;
grant select, insert, update on table public.payments to authenticated;
grant select, insert, update, delete on table public.supply_lists to authenticated;
grant select, insert, update, delete on table public.supply_items to authenticated;
grant select, insert, update, delete on table public.student_supply_checks to authenticated;
grant select, insert, update on table public.student_documents to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.behavior_notes to authenticated;


-- ============================================================================
-- SCHOOLY — BATCH 2 (à exécuter EN UN SEUL RUN dans le SQL Editor)
-- Contenu : school_type + module internat + opérations (rentrée/paiements/documents/messages)
-- Ordre interne : 160000 school_type → 180000 internat → operations (Partie 3)
-- Idempotent : peut être relancé sans risque.
-- ============================================================================

-- ############ 1/3 : TYPE D ÉTABLISSEMENT (school_type) ############
-- ============================================================================
-- SCHOOLY — Ajout du type d'établissement (5 types)
-- ============================================================================

-- 1. Créer l'enum school_type
do $$ begin
  create type school_type as enum (
    'primaire',
    'college',
    'lycee',
    'professionnel',
    'islamique'
  );
exception
  when duplicate_object then null;
end $$;

-- 2. Ajouter la colonne school_type aux établissements
alter table public.establishments
  add column if not exists school_type school_type;

-- 3. Mettre à jour la fonction create_establishment_as_admin pour accepter school_type
create or replace function public.create_establishment_as_admin(
  p_name text,
  p_city text,
  p_address text default null,
  p_description text default null,
  p_school_type school_type default null
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
    raise exception 'Seul un compte parent sans établissement peut en créer un.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 or p_city is null or length(trim(p_city)) = 0 then
    raise exception 'Le nom et la ville de l''établissement sont requis';
  end if;

  insert into public.establishments (name, city, address, description, school_type, created_by)
  values (trim(p_name), trim(p_city), nullif(trim(p_address), ''), nullif(trim(p_description), ''), p_school_type, auth.uid())
  returning * into v_est;

  update public.profiles
    set role = 'admin',
        establishment_id = v_est.id
    where id = auth.uid();

  return v_est;
end;
$$;

-- 4. Re-grant
grant execute on function public.create_establishment_as_admin(text, text, text, text, school_type) to authenticated;

-- ############ 2/3 : MODULE INTERNAT ############
-- ============================================================================
-- SCHOOLY — Module Internat (10 tables)
-- ============================================================================

do $$ begin
  create type internat_gender as enum ('garcon', 'fille', 'mixte');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_room_status as enum ('disponible', 'maintenance', 'complet');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_bed_status as enum ('libre', 'occupe', 'maintenance');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_assignment_status as enum ('actif', 'suspendu', 'termine');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_roll_call_type as enum ('matin', 'soir');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_meal_type as enum ('petit_dejeuner', 'dejeuner', 'diner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_incident_severity as enum ('mineur', 'majeur', 'grave');
exception when duplicate_object then null; end $$;
do $$ begin
  create type internat_incident_category as enum ('discipline', 'sante', 'comportement', 'autre');
exception when duplicate_object then null; end $$;

-- 1. BÂTIMENTS
create table if not exists internat_blocks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  gender internat_gender not null default 'mixte',
  capacity int not null default 0,
  created_at timestamptz not null default now(),
  unique (establishment_id, name)
);

-- 2. CHAMBRES
create table if not exists internat_rooms (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references internat_blocks(id) on delete cascade,
  number text not null,
  bed_count int not null default 2 check (bed_count > 0),
  status internat_room_status not null default 'disponible',
  created_at timestamptz not null default now(),
  unique (block_id, number)
);

-- 3. LITS
create table if not exists internat_beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references internat_rooms(id) on delete cascade,
  bed_number int not null,
  status internat_bed_status not null default 'libre',
  created_at timestamptz not null default now(),
  unique (room_id, bed_number)
);

-- 4. AFFECTATIONS
create table if not exists internat_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  bed_id uuid not null references internat_beds(id) on delete cascade,
  academic_year text not null default '2026-2027',
  start_date date not null default current_date,
  end_date date,
  status internat_assignment_status not null default 'actif',
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, academic_year),
  unique (bed_id, academic_year)
);

-- 5. APPELS (Roll calls)
create table if not exists internat_roll_calls (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references internat_blocks(id) on delete cascade,
  roll_call_date date not null default current_date,
  roll_call_type internat_roll_call_type not null,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (block_id, roll_call_date, roll_call_type)
);

-- 6. DÉTAIL APPEL
create table if not exists internat_roll_items (
  id uuid primary key default gen_random_uuid(),
  roll_call_id uuid not null references internat_roll_calls(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default true,
  note text,
  late_minutes int default 0,
  created_at timestamptz not null default now(),
  unique (roll_call_id, student_id)
);

-- 7. REPAS
create table if not exists internat_meals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  meal_date date not null default current_date,
  meal_type internat_meal_type not null,
  meal_name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (establishment_id, meal_date, meal_type)
);

-- 8. PRÉSENCE REPAS
create table if not exists internat_meal_attendance (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references internat_meals(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  unique (meal_id, student_id)
);

-- 9. INCIDENTS
create table if not exists internat_incidents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  incident_date date not null default current_date,
  severity internat_incident_severity not null default 'mineur',
  category internat_incident_category not null default 'autre',
  title text not null,
  description text,
  reported_by uuid references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);


-- 10. VISITES
create table if not exists internat_visits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  visitor_name text not null,
  visitor_phone text,
  relationship text,
  visit_date date not null default current_date,
  arrive_at timestamptz,
  leave_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 11. SUIVI SANTÉ
create table if not exists internat_health (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  check_date date not null default current_date,
  temperature numeric(4,1),
  weight numeric(5,2),
  symptoms text,
  medication text,
  notes text,
  recorded_by uuid references public.profiles(id),
  parent_notified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- VUES
-- ============================================================================

-- Vue: capacité par bâtiment
create or replace view internat_block_capacity as
select
  b.id as block_id,
  b.establishment_id,
  b.name as block_name,
  b.gender,
  count(bd.id) as total_beds,
  count(bd.id) filter (where bd.status = 'occupe') as occupied_beds,
  count(bd.id) filter (where bd.status = 'libre') as free_beds,
  b.capacity
from internat_blocks b
left join internat_rooms r on r.block_id = b.id
left join internat_beds bd on bd.room_id = r.id
group by b.id, b.establishment_id, b.name, b.gender, b.capacity;

-- Vue: statut des chambres
create or replace view internat_rooms_status_view as
select
  r.id as room_id,
  r.block_id,
  r.number,
  r.bed_count,
  count(bd.id) filter (where bd.status = 'occupe') as occupied,
  count(bd.id) filter (where bd.status = 'libre') as free,
  case
    when count(bd.id) filter (where bd.status = 'occupe') = r.bed_count then 'complet'
    when count(bd.id) filter (where bd.status = 'maintenance') > 0 then 'maintenance'
    else 'disponible'
  end as computed_status
from internat_rooms r
left join internat_beds bd on bd.room_id = r.id
group by r.id, r.block_id, r.number, r.bed_count;

-- ============================================================================
-- RLS
-- ============================================================================

alter table internat_blocks enable row level security;
alter table internat_rooms enable row level security;
alter table internat_beds enable row level security;
alter table internat_assignments enable row level security;
alter table internat_roll_calls enable row level security;
alter table internat_roll_items enable row level security;
alter table internat_meals enable row level security;
alter table internat_meal_attendance enable row level security;
alter table internat_incidents enable row level security;
alter table internat_visits enable row level security;
alter table internat_health enable row level security;

-- Admin: full access to own establishment internat
do $$ begin
  create policy "Admin gère internat" on internat_blocks for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère chambres" on internat_rooms for all
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère lits" on internat_beds for all
    using (room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère affectations" on internat_assignments for all
    using (bed_id in (select id from internat_beds where room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère appels" on internat_roll_calls for all
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère détail appels" on internat_roll_items for all
    using (roll_call_id in (select id from internat_roll_calls where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère repas" on internat_meals for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère présence repas" on internat_meal_attendance for all
    using (meal_id in (select id from internat_meals where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère incidents" on internat_incidents for all
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère visites" on internat_visits for all
    using (student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admin gère suivi santé" on internat_health for all
    using (student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid() and role = 'admin')));
exception when duplicate_object then null; end $$;

-- Staff (secrétariat, censeur): read + limited write
do $$ begin
  create policy "Staff lit internat" on internat_blocks for select
    using (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Staff lit chambres" on internat_rooms for select
    using (block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur'))));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Staff lit lits" on internat_beds for select
    using (room_id in (select id from internat_rooms where block_id in (select id from internat_blocks where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('secretariat', 'censeur')))));
exception when duplicate_object then null; end $$;

-- Grants
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on internat_block_capacity, internat_rooms_status_view to authenticated;
grant execute on all functions in schema public to authenticated;

-- ############ 3/3 : OPÉRATIONS (rentrée, paiements, documents, messages, comportement) ############
-- ============================================================================
-- SCHOOLY — Partie 3 : Rentrée, paiements, documents, messages, comportement
-- Coller d'un coup dans l'éditeur SQL Supabase (après Partie 1 et 2).
-- ============================================================================

do $$ begin
  create type fee_status as enum ('pending', 'partial', 'paid', 'overdue');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('orange_money', 'mtn_momo', 'moov', 'wave', 'cash', 'bank');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('pending', 'confirmed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_type as enum (
    'acte_naissance',
    'photo_identite',
    'carnet_vaccination',
    'bulletin_precedent',
    'certificat_scolarite',
    'piece_identite',
    'dossier_examen',
    'autre'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_status as enum ('missing', 'submitted', 'validated', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type behavior_kind as enum ('positif', 'a_surveiller', 'incident');
exception when duplicate_object then null;
end $$;

create table if not exists fee_categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  description text,
  amount numeric(12,2) not null default 0,
  due_date date,
  school_year text not null default '2026-2027',
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (establishment_id, name, school_year)
);

create table if not exists student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status fee_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (student_id, fee_category_id),
  check (amount_paid >= 0),
  check (amount_paid <= amount + 0.01)
);

create index if not exists idx_student_fees_student on student_fees(student_id);
create index if not exists idx_student_fees_etab on student_fees(establishment_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  student_fee_id uuid references student_fees(id) on delete set null,
  establishment_id uuid not null references establishments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null default 'orange_money',
  reference text,
  status payment_status not null default 'pending',
  paid_at timestamptz,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_payments_etab on payments(establishment_id);

create table if not exists supply_lists (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  level_id uuid not null references levels(id) on delete cascade,
  school_year text not null default '2026-2027',
  title text not null,
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists supply_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references supply_lists(id) on delete cascade,
  name text not null,
  quantity text not null default '1',
  estimated_cost numeric(12,2) not null default 0,
  is_optional boolean not null default false,
  sort_order int not null default 0
);

create table if not exists student_supply_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  supply_item_id uuid not null references supply_items(id) on delete cascade,
  purchased boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, supply_item_id)
);

create table if not exists student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  doc_type document_type not null,
  status document_status not null default 'missing',
  required boolean not null default true,
  alert_from_level text,
  notes text,
  submitted_at timestamptz,
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, doc_type)
);

create index if not exists idx_student_documents_student on student_documents(student_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  recipient_id uuid references profiles(id),
  student_id uuid references students(id) on delete set null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on messages(recipient_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id, created_at desc);

create table if not exists behavior_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  recorded_by uuid not null references profiles(id),
  kind behavior_kind not null default 'a_surveiller',
  title text not null,
  body text,
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_behavior_student on behavior_notes(student_id);

create or replace function refresh_fee_status(p_fee_id uuid)
returns void language plpgsql as $$
declare
  v_fee student_fees;
begin
  select * into v_fee from student_fees where id = p_fee_id for update;
  if v_fee is null then return; end if;
  if v_fee.amount_paid >= v_fee.amount then
    update student_fees set status = 'paid' where id = p_fee_id;
  elsif v_fee.amount_paid > 0 then
    update student_fees set status = 'partial' where id = p_fee_id;
  elsif v_fee.due_date is not null and v_fee.due_date < current_date then
    update student_fees set status = 'overdue' where id = p_fee_id;
  else
    update student_fees set status = 'pending' where id = p_fee_id;
  end if;
end;
$$;

create or replace function record_fee_payment(
  p_student_fee_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_reference text default null,
  p_confirm boolean default false
) returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_fee student_fees;
  v_payment payments;
  v_confirm boolean;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  select * into v_fee from student_fees where id = p_student_fee_id for update;
  if v_fee is null then raise exception 'Echeance introuvable'; end if;

  if v_profile.role = 'parent' then
    if not exists (select 1 from students s where s.id = v_fee.student_id and s.parent_id = auth.uid()) then
      raise exception 'Acces refuse';
    end if;
    v_confirm := false;
  elsif v_profile.role in ('admin', 'secretariat', 'censeur') then
    if v_profile.establishment_id is distinct from v_fee.establishment_id then
      raise exception 'Autre etablissement';
    end if;
    v_confirm := coalesce(p_confirm, true);
  else
    raise exception 'Acces refuse';
  end if;

  insert into payments (
    student_id, student_fee_id, establishment_id, amount, method, reference, status, paid_at, recorded_by
  ) values (
    v_fee.student_id, v_fee.id, v_fee.establishment_id, p_amount, p_method, nullif(trim(p_reference), ''),
    case when v_confirm then 'confirmed' else 'pending' end,
    case when v_confirm then now() else null end,
    auth.uid()
  ) returning * into v_payment;

  if v_confirm then
    update student_fees
      set amount_paid = least(amount, amount_paid + p_amount)
      where id = v_fee.id;
    perform refresh_fee_status(v_fee.id);
  end if;

  return v_payment;
end;
$$;

create or replace function confirm_fee_payment(p_payment_id uuid)
returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_payment payments;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or v_profile.role not in ('admin', 'secretariat', 'censeur') then
    raise exception 'Acces refuse';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Paiement introuvable'; end if;
  if v_profile.establishment_id is distinct from v_payment.establishment_id then
    raise exception 'Autre etablissement';
  end if;
  if v_payment.status = 'confirmed' then return v_payment; end if;

  update payments
    set status = 'confirmed', paid_at = now()
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.student_fee_id is not null then
    update student_fees
      set amount_paid = least(amount, amount_paid + v_payment.amount)
      where id = v_payment.student_fee_id;
    perform refresh_fee_status(v_payment.student_fee_id);
  end if;

  return v_payment;
end;
$$;

create or replace function assign_fees_to_student(p_student_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_student students;
  v_count int := 0;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return 0; end if;

  insert into student_fees (student_id, fee_category_id, establishment_id, amount, due_date)
  select v_student.id, fc.id, fc.establishment_id, fc.amount, fc.due_date
  from fee_categories fc
  where fc.establishment_id = v_student.establishment_id
  on conflict (student_id, fee_category_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function seed_student_documents(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_student students;
begin
  select * into v_student from students where id = p_student_id;
  if v_student is null then return; end if;

  insert into student_documents (student_id, establishment_id, doc_type, required, alert_from_level)
  values
    (v_student.id, v_student.establishment_id, 'acte_naissance', true, null),
    (v_student.id, v_student.establishment_id, 'photo_identite', true, null),
    (v_student.id, v_student.establishment_id, 'carnet_vaccination', true, null),
    (v_student.id, v_student.establishment_id, 'bulletin_precedent', false, null),
    (v_student.id, v_student.establishment_id, 'piece_identite', true, 'CM1'),
    (v_student.id, v_student.establishment_id, 'dossier_examen', true, 'CM2')
  on conflict (student_id, doc_type) do nothing;
end;
$$;

create or replace function after_student_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform seed_student_documents(new.id);
  perform assign_fees_to_student(new.id);
  return new;
end;
$$;

drop trigger if exists after_student_insert_trg on students;
create trigger after_student_insert_trg
  after insert on students
  for each row execute procedure after_student_insert();

create or replace function send_school_message(
  p_recipient_id uuid,
  p_student_id uuid,
  p_subject text,
  p_body text
) returns messages
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_student students;
  v_etab uuid;
  v_msg messages;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  if p_subject is null or length(trim(p_subject)) = 0 or p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Sujet et message requis';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then raise exception 'Profil introuvable'; end if;

  v_etab := v_profile.establishment_id;

  if p_student_id is not null then
    select * into v_student from students where id = p_student_id;
    if v_student is null then raise exception 'Eleve introuvable'; end if;
    v_etab := v_student.establishment_id;
    if v_profile.role = 'parent' and v_student.parent_id is distinct from auth.uid() then
      raise exception 'Acces refuse';
    end if;
    if v_profile.role <> 'parent' and v_profile.establishment_id is distinct from v_student.establishment_id then
      raise exception 'Acces refuse';
    end if;
  end if;

  if v_etab is null then raise exception 'Etablissement introuvable'; end if;

  if p_recipient_id is null then raise exception 'Destinataire requis'; end if;

  insert into messages (establishment_id, sender_id, recipient_id, student_id, subject, body)
  values (v_etab, auth.uid(), p_recipient_id, p_student_id, trim(p_subject), trim(p_body))
  returning * into v_msg;

  return v_msg;
end;
$$;

alter table fee_categories enable row level security;
alter table student_fees enable row level security;
alter table payments enable row level security;
alter table supply_lists enable row level security;
alter table supply_items enable row level security;
alter table student_supply_checks enable row level security;
alter table student_documents enable row level security;
alter table messages enable row level security;
alter table behavior_notes enable row level security;

drop policy if exists "fees_cat_staff" on fee_categories;
create policy "fees_cat_staff" on fee_categories for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "fees_cat_parent" on fee_categories;
create policy "fees_cat_parent" on fee_categories for select using (
  establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sfees_staff" on student_fees;
create policy "sfees_staff" on student_fees for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "sfees_parent" on student_fees;
create policy "sfees_parent" on student_fees for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "pay_staff" on payments;
create policy "pay_staff" on payments for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid())
);

drop policy if exists "pay_parent" on payments;
create policy "pay_parent" on payments for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "sup_list_staff" on supply_lists;
create policy "sup_list_staff" on supply_lists for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat')));

drop policy if exists "sup_list_parent" on supply_lists;
create policy "sup_list_parent" on supply_lists for select using (
  published = true and establishment_id in (select establishment_id from students where parent_id = auth.uid())
);

drop policy if exists "sup_items_staff" on supply_items;
create policy "sup_items_staff" on supply_items for all
  using (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid())))
  with check (list_id in (select id from supply_lists where establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat'))));

drop policy if exists "sup_items_parent" on supply_items;
create policy "sup_items_parent" on supply_items for select using (
  list_id in (
    select sl.id from supply_lists sl
    where sl.published = true
      and sl.establishment_id in (select establishment_id from students where parent_id = auth.uid())
  )
);

drop policy if exists "sup_check_parent" on student_supply_checks;
create policy "sup_check_parent" on student_supply_checks for all
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "sup_check_staff" on student_supply_checks;
create policy "sup_check_staff" on student_supply_checks for select using (
  student_id in (select id from students where establishment_id in (select establishment_id from profiles where id = auth.uid()))
);

drop policy if exists "docs_staff" on student_documents;
create policy "docs_staff" on student_documents for all
  using (establishment_id in (select establishment_id from profiles where id = auth.uid()))
  with check (establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur')));

drop policy if exists "docs_parent_select" on student_documents;
create policy "docs_parent_select" on student_documents for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

drop policy if exists "docs_parent_update" on student_documents;
create policy "docs_parent_update" on student_documents for update
  using (student_id in (select id from students where parent_id = auth.uid()))
  with check (student_id in (select id from students where parent_id = auth.uid()));

drop policy if exists "msg_own" on messages;
create policy "msg_own" on messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

drop policy if exists "msg_own_update" on messages;
create policy "msg_own_update" on messages for update using (
  sender_id = auth.uid() or recipient_id = auth.uid()
)
with check (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "msg_staff_select" on messages;
create policy "msg_staff_select" on messages for select using (
  establishment_id in (select establishment_id from profiles where id = auth.uid() and role in ('admin','secretariat','censeur','professeur'))
);

drop policy if exists "beh_teacher" on behavior_notes;
create policy "beh_teacher" on behavior_notes for all
  using (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  )
  with check (
    section_id in (select section_id from teacher_assignments where teacher_id = auth.uid())
    or section_id in (
      select s.id from sections s
      join levels l on l.id = s.level_id
      join profiles p on p.establishment_id = l.establishment_id
      where p.id = auth.uid() and p.role in ('admin','censeur')
    )
  );

drop policy if exists "beh_parent" on behavior_notes;
create policy "beh_parent" on behavior_notes for select using (
  student_id in (select id from students where parent_id = auth.uid())
);

revoke all on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) from public, anon;
revoke all on function public.confirm_fee_payment(uuid) from public, anon;
revoke all on function public.assign_fees_to_student(uuid) from public, anon;
revoke all on function public.seed_student_documents(uuid) from public, anon;
revoke all on function public.after_student_insert() from public, anon, authenticated;
revoke all on function public.send_school_message(uuid, uuid, text, text) from public, anon;
revoke all on function public.refresh_fee_status(uuid) from public, anon, authenticated;

grant execute on function public.record_fee_payment(uuid, numeric, payment_method, text, boolean) to authenticated;
grant execute on function public.confirm_fee_payment(uuid) to authenticated;
grant execute on function public.assign_fees_to_student(uuid) to authenticated;
grant execute on function public.send_school_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.seed_student_documents(uuid) to authenticated;

grant select, insert, update, delete on table public.fee_categories to authenticated;
grant select, insert, update, delete on table public.student_fees to authenticated;
grant select, insert, update on table public.payments to authenticated;
grant select, insert, update, delete on table public.supply_lists to authenticated;
grant select, insert, update, delete on table public.supply_items to authenticated;
grant select, insert, update, delete on table public.student_supply_checks to authenticated;
grant select, insert, update on table public.student_documents to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.behavior_notes to authenticated;
