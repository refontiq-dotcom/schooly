-- Publication volontaire des établissements dans Trouvetou.
alter table public.establishments
  add column if not exists published_to_trouvetou boolean not null default false;

create index if not exists idx_establishments_trouvetou_published
  on public.establishments (published_to_trouvetou)
  where published_to_trouvetou = true;

-- Crée une réservation partenaire et réserve la place dans la même transaction.
create or replace function public.create_trouvetou_reservation(
  p_establishment_id uuid,
  p_level_id uuid,
  p_student_full_name text,
  p_student_birthdate date default null,
  p_parent_full_name text default null,
  p_parent_phone text default null,
  p_parent_email text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment public.establishments;
  v_section public.sections;
  v_reservation public.reservations;
begin
  if nullif(trim(p_student_full_name), '') is null
     or nullif(trim(p_parent_full_name), '') is null
     or nullif(trim(p_parent_phone), '') is null then
    raise exception 'Nom de l''élève, nom du parent et téléphone requis';
  end if;

  select * into v_establishment
  from public.establishments
  where id = p_establishment_id
    and published_to_trouvetou = true;

  if v_establishment is null then
    raise exception 'Établissement non publié dans Trouvetou';
  end if;

  if not exists (
    select 1 from public.levels
    where id = p_level_id and establishment_id = p_establishment_id
  ) then
    raise exception 'Niveau invalide pour cet établissement';
  end if;

  select * into v_section
  from public.sections
  where level_id = p_level_id
    and seats_taken < capacity
  order by name
  limit 1
  for update;

  if v_section is null then
    raise exception 'Plus de place disponible pour ce niveau';
  end if;

  update public.sections
    set seats_taken = seats_taken + 1
    where id = v_section.id;

  insert into public.reservations (
    establishment_id, level_id, section_id, student_full_name,
    student_birthdate, parent_full_name, parent_phone, parent_email,
    status, expires_at
  ) values (
    p_establishment_id, p_level_id, v_section.id, trim(p_student_full_name),
    p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
    nullif(trim(p_parent_email), ''), 'reserved',
    now() + (v_establishment.reservation_hold_hours || ' hours')::interval
  ) returning * into v_reservation;

  return v_reservation;
end;
$$;

revoke all on function public.create_trouvetou_reservation(uuid, uuid, text, date, text, text, text)
  from public, anon, authenticated;
