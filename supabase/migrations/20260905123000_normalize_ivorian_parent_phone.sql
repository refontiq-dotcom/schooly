-- Normalize common Côte d'Ivoire phone formats so +225 07... and 07... identify the same parent.
create or replace function public.normalize_schooly_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(p_phone,''), '\\D', '', 'g') like '225%' then regexp_replace(coalesce(p_phone,''), '\\D', '', 'g')
    when length(regexp_replace(coalesce(p_phone,''), '\\D', '', 'g')) = 10
      then '225' || regexp_replace(coalesce(p_phone,''), '\\D', '', 'g')
    else regexp_replace(coalesce(p_phone,''), '\\D', '', 'g')
  end;
$$;

create or replace function public.parent_phone_is_registered_for(p_phone text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students s
    where public.normalize_schooly_phone(s.parent_phone) = public.normalize_schooly_phone(p_phone)
      and public.normalize_schooly_phone(p_phone) <> ''
  );
$$;

create or replace function public.parent_phone_is_registered()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.parent_phone_is_registered_for(auth.jwt()->>'phone');
$$;

create or replace function public.link_parent_students_by_phone()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_schooly_phone(auth.jwt()->>'phone');
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null or v_phone = '' then return 0; end if;

  update public.students s
  set parent_id = v_user_id
  where public.normalize_schooly_phone(s.parent_phone) = v_phone
    and (s.parent_id is null or s.parent_id <> v_user_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.normalize_schooly_phone(text) from public, anon, authenticated;
revoke all on function public.parent_phone_is_registered_for(text) from public;
grant execute on function public.parent_phone_is_registered_for(text) to anon, authenticated;
revoke all on function public.parent_phone_is_registered() from public, anon;
grant execute on function public.parent_phone_is_registered() to authenticated;
revoke all on function public.link_parent_students_by_phone() from public, anon;
grant execute on function public.link_parent_students_by_phone() to authenticated;
