-- ============================================================================
-- SCHOOLY — Gestion de classes (onboarding + effectif réel)
-- ============================================================================
-- * seed des niveaux prédéfinis à la création d'un établissement
-- * vue class_section_rosters : effectif réel (count students) vs seats_taken
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fonction : créer les niveaux (et une section par défaut) selon school_type
-- ----------------------------------------------------------------------------
create or replace function public.seed_preset_levels_for_establishment(
  p_establishment_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.school_type;
  v_names text[];
  v_name text;
  v_rank int := 0;
  v_level_id uuid;
  v_created int := 0;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and establishment_id = p_establishment_id
  ) and not exists (
    select 1 from public.establishments
    where id = p_establishment_id
      and created_by = auth.uid()
  ) then
    raise exception 'Action réservée à l''administrateur de cet établissement';
  end if;

  select school_type into v_type
  from public.establishments
  where id = p_establishment_id;

  if v_type is null then
    return 0;
  end if;

  v_names := case v_type
    when 'primaire' then array['Maternelle','CP1','CP2','CE1','CE2','CM1','CM2']
    when 'college' then array['6ème','5ème','4ème','3ème']
    when 'lycee' then array['Seconde','Première','Terminale']
    when 'professionnel' then array['1ère année','2ème année','3ème année']
    when 'islamique' then array['Coran','Arabe','Fiqh','Hadith','Sira']
    else array[]::text[]
  end;

  foreach v_name in array v_names loop
    v_rank := v_rank + 1;
    insert into public.levels (establishment_id, name, rank)
    values (p_establishment_id, v_name, v_rank)
    on conflict (establishment_id, name) do nothing
    returning id into v_level_id;

    if v_level_id is not null then
      v_created := v_created + 1;
      insert into public.sections (level_id, name, capacity)
      values (v_level_id, v_name || '1', 30)
      on conflict (level_id, name) do nothing;
    end if;
  end loop;

  return v_created;
end;
$$;

grant execute on function public.seed_preset_levels_for_establishment(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Brancher le seed dans create_establishment_as_admin
-- ----------------------------------------------------------------------------
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

  perform public.seed_preset_levels_for_establishment(v_est.id);

  return v_est;
end;
$$;

grant execute on function public.create_establishment_as_admin(text, text, text, text, school_type) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Vue : effectif réel vs compteur (consultation intelligente)
-- ----------------------------------------------------------------------------
create or replace view public.class_section_rosters as
select
  s.id as section_id,
  s.level_id,
  l.establishment_id,
  l.name as level_name,
  s.name as section_name,
  s.capacity,
  s.seats_taken,
  s.homeroom_teacher_id,
  hp.full_name as homeroom_teacher_name,
  count(st.id)::int as student_count,
  (s.capacity - count(st.id)::int) as seats_free,
  case when s.capacity = 0 then 0
    else round(100.0 * count(st.id) / s.capacity)
  end as real_fill_rate_pct,
  (count(st.id)::int <> s.seats_taken) as seats_mismatch,
  (
    select count(*)::int
    from public.teacher_assignments ta
    where ta.section_id = s.id
  ) as teachers_count
from public.sections s
join public.levels l on l.id = s.level_id
left join public.profiles hp on hp.id = s.homeroom_teacher_id
left join public.students st on st.section_id = s.id
group by
  s.id, s.level_id, l.establishment_id, l.name, s.name,
  s.capacity, s.seats_taken, s.homeroom_teacher_id, hp.full_name;

grant select on public.class_section_rosters to authenticated, service_role;
