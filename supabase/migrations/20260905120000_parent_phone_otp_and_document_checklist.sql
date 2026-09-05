-- SCHOOLY — Parent access by registered phone + physical enrollment checklist
-- Parent authentication is allowed only when the phone was used for an enrolled student.

-- Physical enrollment documents are a checklist for now: missing / provided.
alter table public.enrollment_documents
  drop constraint if exists enrollment_documents_status_check;

update public.enrollment_documents
set status = case
  when status in ('submitted','validated') then 'provided'
  else 'missing'
end;

alter table public.enrollment_documents
  add constraint enrollment_documents_status_check
  check (status in ('missing','provided'));

-- A parent identity is global: the same phone may be attached to children in
-- different establishments. The authenticated Supabase phone is the key.
create or replace function public.parent_phone_is_registered()
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
      = regexp_replace(coalesce(auth.jwt()->>'phone',''), '\\D', '', 'g')
      and regexp_replace(coalesce(s.parent_phone,''), '\\D', '', 'g') <> ''
  );
$$;

revoke all on function public.parent_phone_is_registered() from public, anon;
grant execute on function public.parent_phone_is_registered() to authenticated;

-- Parent can see an enrollment dossier only when the authenticated phone is
-- the phone recorded on that dossier AND that phone exists on a student.
drop policy if exists "Parent voit ses dossiers d'inscription" on public.enrollment_applications;
create policy "Parent voit ses dossiers par téléphone"
on public.enrollment_applications
for select
using (
  public.parent_phone_is_registered()
  and regexp_replace(coalesce(parent_phone,''), '\\D', '', 'g')
      = regexp_replace(coalesce(auth.jwt()->>'phone',''), '\\D', '', 'g')
);

-- Parent document checklist is read-only for now. No file upload/scanning.
drop policy if exists "Parent voit ses documents d'inscription" on public.enrollment_documents;
create policy "Parent voit ses documents par téléphone"
on public.enrollment_documents
for select
using (
  enrollment_id in (
    select ea.id
    from public.enrollment_applications ea
    where public.parent_phone_is_registered()
      and regexp_replace(coalesce(ea.parent_phone,''), '\\D', '', 'g')
          = regexp_replace(coalesce(auth.jwt()->>'phone',''), '\\D', '', 'g')
  )
);

drop policy if exists "Parent ajoute ses documents d'inscription" on public.enrollment_documents;

-- Physical/online enrollment may later link the authenticated parent profile.
-- This helper attaches every student using the authenticated phone to the
-- current parent profile, including children in different establishments.
create or replace function public.link_parent_students_by_phone()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(auth.jwt()->>'phone',''), '\\D', '', 'g');
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null or v_phone = '' then
    return 0;
  end if;

  update public.students s
  set parent_id = v_user_id
  where regexp_replace(coalesce(s.parent_phone,''), '\\D', '', 'g') = v_phone
    and (s.parent_id is null or s.parent_id <> v_user_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.link_parent_students_by_phone() from public, anon;
grant execute on function public.link_parent_students_by_phone() to authenticated;
