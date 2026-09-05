-- Public-safe lookup used before sending an OTP.
-- It only answers whether the normalized phone exists on students.parent_phone.
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
    where regexp_replace(coalesce(s.parent_phone,''), '\\D', '', 'g')
      = regexp_replace(coalesce(p_phone,''), '\\D', '', 'g')
      and regexp_replace(coalesce(p_phone,''), '\\D', '', 'g') <> ''
  );
$$;

revoke all on function public.parent_phone_is_registered_for(text) from public;
grant execute on function public.parent_phone_is_registered_for(text) to anon, authenticated;
