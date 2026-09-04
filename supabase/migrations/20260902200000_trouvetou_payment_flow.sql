-- Le partenaire crée d'abord un dossier en attente de paiement.
-- La capacité est réservée atomiquement lors de la confirmation du paiement.
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

  insert into public.reservations (
    establishment_id, level_id, section_id, student_full_name,
    student_birthdate, parent_full_name, parent_phone, parent_email,
    status
  ) values (
    p_establishment_id, p_level_id, v_section.id, trim(p_student_full_name),
    p_student_birthdate, trim(p_parent_full_name), trim(p_parent_phone),
    nullif(trim(p_parent_email), ''), 'pending_payment'
  ) returning * into v_reservation;

  return v_reservation;
end;
$$;
