-- Refonqiq Control Center is the only platform Super Admin.
-- Schooly keeps the legacy role value only for schema/RLS compatibility,
-- but no Schooly account may hold an active super_admin assignment.

update public.user_school_roles
set is_active = false
where role_code = 'super_admin'
  and is_active = true;

update public.roles
set label = 'Super Admin plateforme — géré exclusivement par Refontiq Control Center'
where code = 'super_admin';

create or replace function public.block_schooly_super_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_code = 'super_admin' then
    raise exception 'SUPER_ADMIN_PLATFORM_ONLY: le Super Admin est géré exclusivement par Refontiq Control Center';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_schooly_super_admin_assignment on public.user_school_roles;
create trigger trg_block_schooly_super_admin_assignment
before insert or update of role_code, is_active on public.user_school_roles
for each row
execute function public.block_schooly_super_admin_assignment();
