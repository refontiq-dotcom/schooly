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
