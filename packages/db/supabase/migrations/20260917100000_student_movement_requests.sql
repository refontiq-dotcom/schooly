-- Préparation uniquement : code de suivi non activé, aucune inscription/finance modifiée.
begin;

-- Code de suivi : préfixe + 4 symboles aléatoires + checksum (8 caractères).
-- Ce code court n'est jamais une autorisation d'accès ni un code d'import actif.
create function public.movement_code_checksum(body text) returns text
language plpgsql immutable strict set search_path = public as $$
declare alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; total integer := 0; pos integer;
begin
  if length(body) <> 7 or left(body,3) not in ('TRF','ORT') then return null; end if;
  total := ascii(substr(body,1,1)) + 3*ascii(substr(body,2,1)) + 5*ascii(substr(body,3,1));
  for i in 4..7 loop
    pos := strpos(alphabet,substr(body,i,1)) - 1;
    if pos < 0 then return null; end if;
    total := total + pos * (2*i-1);
  end loop;
  return substr(alphabet, (total % 32)+1, 1);
end $$;

create table public.student_movement_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  enrollment_id uuid not null references public.enrollments(id),
  student_id uuid not null references public.students(id),
  kind text not null check (kind in ('TRF','ORT')),
  tracking_code text not null unique check (
    length(tracking_code) = 8 and left(tracking_code,3) = kind
    and public.movement_code_checksum(left(tracking_code,7)) is not null
    and right(tracking_code,1) = public.movement_code_checksum(left(tracking_code,7))
  ),
  reason text not null check (length(trim(reason)) between 3 and 500),
  decision_reference text,
  issuing_authority text,
  scholarship_status text check (scholarship_status in ('boursier','non_boursier','inconnu')),
  national_matricule text,
  status text not null default 'DRAFT' check (status = 'DRAFT'),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (enrollment_id),
  check ((kind = 'TRF' and decision_reference is null and issuing_authority is null
    and scholarship_status is null) or (kind = 'ORT'
    and decision_reference is not null and length(trim(decision_reference)) between 1 and 150
    and issuing_authority is not null and length(trim(issuing_authority)) between 1 and 150
    and scholarship_status is not null
    and national_matricule is not null and length(trim(national_matricule)) > 0))
);

create function public.validate_student_movement_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments;
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  random_bytes bytea;
  body text;
begin
  if tg_op <> 'INSERT' then
    raise exception 'La modification des demandes n’est pas disponible dans cette version.';
  end if;
  select * into e from public.enrollments where id = new.enrollment_id
    and school_id = new.school_id and deleted_at is null and status = 'active' for share;
  if not found or not exists (select 1 from public.students s
    where s.id = e.student_id and s.school_id = e.school_id and s.deleted_at is null) then
    raise exception 'Inscription active introuvable dans cet établissement.';
  end if;
  new.student_id := e.student_id;
  new.national_matricule := nullif(trim(e.matricule), '');
  new.created_by := auth.uid();
  new.created_at := now();
  if new.kind = 'ORT' and new.national_matricule is null then
    raise exception 'Le matricule national doit être renseigné dans l’inscription avant de préparer une orientation.';
  end if;
  -- Sérialise les allocations ; la contrainte UNIQUE reste la garantie finale.
  perform pg_advisory_xact_lock(17100000, 1);
  for attempt in 1..32 loop
    random_bytes := decode(substr(replace(gen_random_uuid()::text, '-', ''),1,8),'hex');
    body := new.kind;
    for i in 0..3 loop
      body := body || substr(alphabet,(get_byte(random_bytes,i) % 32)+1,1);
    end loop;
    new.tracking_code := body || public.movement_code_checksum(body);
    exit when not exists (select 1 from public.student_movement_requests where tracking_code = new.tracking_code);
    if attempt = 32 then raise exception 'Allocation du code impossible. Réessayez.'; end if;
  end loop;
  return new;
end $$;
create trigger student_movement_requests_validate before insert or update or delete
  on public.student_movement_requests for each row execute function public.validate_student_movement_request();

alter table public.student_movement_requests enable row level security;
create policy movement_requests_read on public.student_movement_requests for select to authenticated
  using (public.has_school_role(school_id, array['direction','secretariat','super_admin']));
create policy movement_requests_insert on public.student_movement_requests for insert to authenticated
  with check (created_by = auth.uid() and public.has_school_role(school_id, array['direction','secretariat','super_admin']));
grant select, insert on public.student_movement_requests to authenticated;
revoke all on function public.validate_student_movement_request() from public;
commit;
