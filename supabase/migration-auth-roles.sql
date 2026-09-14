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
