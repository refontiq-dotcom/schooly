-- ============================================================================
-- SCHOOL GROUPS — Multi-branch support (réseau scolaire)
-- ============================================================================
-- Idempotent migration: creates school_groups table and adds group_id to
-- establishments. Enables a school group (e.g. "Réseau Scolaire Progrès")
-- to manage multiple branches across different cities.
-- ============================================================================

create table if not exists school_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  logo_url text,
  headquarters_city text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add group_id FK to establishments
do $$ begin
  alter table establishments add column group_id uuid references school_groups(id) on delete set null;
exception
  when duplicate_column then null;
end $$;

-- Add branch_name to establishments (optional subtitle like "Succursale Abidjan")
do $$ begin
  alter table establishments add column branch_name text;
exception
  when duplicate_column then null;
end $$;

-- Indexes
create index if not exists idx_establishments_group_id on establishments(group_id) where group_id is not null;
create index if not exists idx_school_groups_created_by on school_groups(created_by);

-- ============================================================================
-- RLS
-- ============================================================================

alter table school_groups enable row level security;

-- Super admin manages their groups
drop policy if exists "Admin manages own school groups" on school_groups;
create policy "Admin manages own school groups"
  on school_groups for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Staff in the group can view the group
drop policy if exists "Staff views school group" on school_groups;
create policy "Staff views school group"
  on school_groups for select
  using (
    id in (
      select e.group_id from establishments e
      join profiles p on p.establishment_id = e.id
      where p.id = auth.uid()
    )
  );

-- Parents whose children are in a branch of the group can view it
drop policy if exists "Parents view school group" on school_groups;
create policy "Parents view school group"
  on school_groups for select
  using (
    id in (
      select e.group_id from establishments e
      join levels l on l.establishment_id = e.id
      join sections s on s.level_id = l.id
      join students st on st.section_id = s.id
      where st.parent_id = auth.uid()
    )
  );

-- Public read for published groups (used on the public establishment page)
drop policy if exists "Public can view school groups" on school_groups;
create policy "Public can view school groups"
  on school_groups for select
  using (true);

-- ============================================================================
-- Helper view: group stats (total branches, students, staff)
-- ============================================================================

create or replace view school_group_stats as
select
  sg.id as group_id,
  sg.name as group_name,
  count(distinct e.id) as branch_count,
  count(distinct st.id) as total_students,
  count(distinct p.id) filter (where p.role = 'admin') as admin_count,
  count(distinct p.id) filter (where p.role = 'professeur') as teacher_count,
  count(distinct p.id) filter (where p.role = 'secretariat') as secretariat_count
from school_groups sg
left join establishments e on e.group_id = sg.id
left join levels l on l.establishment_id = e.id
left join sections s on s.level_id = l.id
left join students st on st.section_id = s.id
left join profiles p on p.establishment_id = e.id
group by sg.id, sg.name;

-- ============================================================================
-- RPC: create_school_group — creates a group and assigns the creator as super admin
-- ============================================================================

create or replace function create_school_group(
  p_name text,
  p_description text default null,
  p_headquarters_city text default null,
  p_logo_url text default null
) returns school_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_group school_groups;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Profil introuvable';
  end if;

  if v_profile.role <> 'admin' then
    raise exception 'Seul un administrateur peut créer un réseau scolaire';
  end if;

  insert into school_groups (name, description, headquarters_city, logo_url, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_headquarters_city), ''), p_logo_url, auth.uid())
  returning * into v_group;

  return v_group;
end;
$$;

-- ============================================================================
-- RPC: add_branch_to_group — adds an existing establishment to a group
-- ============================================================================

create or replace function add_branch_to_group(
  p_group_id uuid,
  p_establishment_id uuid,
  p_branch_name text default null
) returns establishments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_establishment establishments;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  -- Check that the user owns the group
  if not exists (
    select 1 from school_groups where id = p_group_id and created_by = auth.uid()
  ) then
    raise exception 'Vous n''êtes pas le propriétaire de ce réseau scolaire';
  end if;

  -- Check that the user manages the establishment
  select * into v_profile from profiles where id = auth.uid() and role = 'admin' and establishment_id = p_establishment_id;
  if v_profile is null then
    raise exception 'Vous n''êtes pas admin de cet établissement';
  end if;

  update establishments
    set group_id = p_group_id,
        branch_name = nullif(trim(p_branch_name), '')
  where id = p_establishment_id
  returning * into v_establishment;

  return v_establishment;
end;
$$;

-- ============================================================================
-- RPC: remove_branch_from_group — removes an establishment from its group
-- ============================================================================

create or replace function remove_branch_from_group(
  p_establishment_id uuid
) returns establishments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_establishment establishments;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_establishment from establishments where id = p_establishment_id;
  if v_establishment is null then
    raise exception 'Établissement introuvable';
  end if;

  -- Check: either the user owns the group, or the user is admin of the establishment
  if v_establishment.group_id is not null then
    if not exists (
      select 1 from school_groups where id = v_establishment.group_id and created_by = auth.uid()
    ) then
      -- Check if user is admin of this establishment
      select * into v_profile from profiles where id = auth.uid() and role = 'admin' and establishment_id = p_establishment_id;
      if v_profile is null then
        raise exception 'Accès refusé';
      end if;
    end if;
  end if;

  update establishments
    set group_id = null,
        branch_name = null
  where id = p_establishment_id
  returning * into v_establishment;

  return v_establishment;
end;
$$;

-- ============================================================================
-- RPC: get_group_branches — returns all branches in a group with stats
-- ============================================================================

create or replace function get_group_branches(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_agg(json_build_object(
    'id', e.id,
    'name', e.name,
    'city', e.city,
    'branch_name', e.branch_name,
    'school_type', e.school_type,
    'logo_url', e.logo_url,
    'student_count', coalesce((
      select count(*) from students st
      join sections sec on sec.id = st.section_id
      join levels lev on lev.id = sec.level_id
      where lev.establishment_id = e.id
    ), 0)
  ) order by e.name)
  into v_result
  from establishments e
  where e.group_id = p_group_id;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- Revoke + Grant
revoke all on function create_school_group(text, text, text, text) from public, anon;
revoke all on function add_branch_to_group(uuid, uuid, text) from public, anon;
revoke all on function remove_branch_from_group(uuid) from public, anon;
revoke all on function get_group_branches(uuid) from public, anon;

grant execute on function create_school_group(text, text, text, text) to authenticated;
grant execute on function add_branch_to_group(uuid, uuid, text) to authenticated;
grant execute on function remove_branch_from_group(uuid) to authenticated;
grant execute on function get_group_branches(uuid) to authenticated;

grant select, insert, update, delete on table school_groups to authenticated;
