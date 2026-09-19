-- 20260919020000 — Admissions : import Ministère + affectation intelligente
-- Version durcie : RLS + grants minimaux + fonction de commit protégée.

create table if not exists public.admission_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  filename text not null,
  source text not null default 'ministere',
  status text not null default 'draft',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admission_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admission_import_batches(id) on delete cascade,
  row_number integer not null,
  external_id text,
  matricule text,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text,
  grade_level_id uuid references public.grade_levels(id),
  grade_name text,
  orientation_number text,
  academic_score numeric,
  required_options jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  status text not null default 'ready',
  error_message text,
  created_at timestamptz not null default now(),
  unique(batch_id, row_number)
);

create index if not exists idx_admission_import_batches_school
  on public.admission_import_batches(school_id, academic_year_id, created_at desc);
create index if not exists idx_admission_import_rows_batch
  on public.admission_import_rows(batch_id, row_number);

alter table public.classes
  add column if not exists required_options jsonb not null default '[]'::jsonb;

alter table public.pre_enrollments
  add column if not exists import_row_id uuid references public.admission_import_rows(id) on delete set null,
  add column if not exists suggested_class_id uuid references public.classes(id) on delete set null;

create table if not exists public.admission_assignment_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels(id) on delete restrict,
  source_batch_id uuid references public.admission_import_batches(id) on delete set null,
  algorithm text not null default 'serpentin',
  status text not null default 'preview',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admission_assignment_rows (
  id uuid primary key default gen_random_uuid(),
  assignment_batch_id uuid not null references public.admission_assignment_batches(id) on delete cascade,
  import_row_id uuid not null references public.admission_import_rows(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  position integer not null,
  score numeric(12,4) not null default 0,
  hard_valid boolean not null default true,
  soft_score numeric(12,4) not null default 0,
  constraint_reason text,
  created_at timestamptz not null default now(),
  unique(assignment_batch_id, import_row_id),
  unique(assignment_batch_id, position)
);

create index if not exists idx_admission_assignment_rows_batch
  on public.admission_assignment_rows(assignment_batch_id, position);

alter table public.admission_import_batches enable row level security;
alter table public.admission_import_rows enable row level security;
alter table public.admission_assignment_batches enable row level security;
alter table public.admission_assignment_rows enable row level security;

revoke all on table public.admission_import_batches from anon, authenticated;
revoke all on table public.admission_import_rows from anon, authenticated;
revoke all on table public.admission_assignment_batches from anon, authenticated;
revoke all on table public.admission_assignment_rows from anon, authenticated;
grant select, insert, update, delete on table public.admission_import_batches to authenticated;
grant select, insert, update, delete on table public.admission_import_rows to authenticated;
grant select, insert, update, delete on table public.admission_assignment_batches to authenticated;
grant select, insert, update, delete on table public.admission_assignment_rows to authenticated;

drop policy if exists admission_import_batches_member on public.admission_import_batches;
create policy admission_import_batches_member on public.admission_import_batches
  for all to authenticated
  using ((select is_super_admin()) or (select is_school_member(school_id)))
  with check ((select is_super_admin()) or (select is_school_member(school_id)));

drop policy if exists admission_import_rows_member on public.admission_import_rows;
create policy admission_import_rows_member on public.admission_import_rows
  for all to authenticated
  using (exists (
    select 1 from public.admission_import_batches b
    where b.id = batch_id and ((select is_super_admin()) or (select is_school_member(b.school_id)))
  )) with check (exists (
    select 1 from public.admission_import_batches b
    where b.id = batch_id and ((select is_super_admin()) or (select is_school_member(b.school_id)))
  ));

drop policy if exists admission_assignment_batches_member on public.admission_assignment_batches;
create policy admission_assignment_batches_member on public.admission_assignment_batches
  for all to authenticated
  using ((select is_super_admin()) or (select is_school_member(school_id)))
  with check ((select is_super_admin()) or (select is_school_member(school_id)));

drop policy if exists admission_assignment_rows_member on public.admission_assignment_rows;
create policy admission_assignment_rows_member on public.admission_assignment_rows
  for all to authenticated
  using (exists (
    select 1 from public.admission_assignment_batches b
    where b.id = assignment_batch_id and ((select is_super_admin()) or (select is_school_member(b.school_id)))
  )) with check (exists (
    select 1 from public.admission_assignment_batches b
    where b.id = assignment_batch_id and ((select is_super_admin()) or (select is_school_member(b.school_id)))
  ));

comment on table public.admission_import_batches is 'Imports officiels de listes d élèves affectés.';
comment on table public.admission_assignment_batches is 'Prévisualisations d affectation automatique par classe.';
comment on column public.admission_assignment_rows.soft_score is 'Score souple : équilibre des profils sans jamais contourner une contrainte dure.';

create or replace function public.commit_admission_assignment(p_assignment_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.admission_assignment_batches%rowtype;
  v_row record;
  v_count integer := 0;
  v_created integer := 0;
begin
  select * into v_batch
  from public.admission_assignment_batches
  where id = p_assignment_batch_id
  for update;

  if not found then raise exception 'Affectation introuvable.'; end if;
  if v_batch.status <> 'preview' then raise exception 'Cette affectation a déjà été validée ou n est plus modifiable.'; end if;
  if not ((select public.is_super_admin()) or (select public.is_school_member(v_batch.school_id))) then
    raise exception 'Accès refusé.';
  end if;

  select count(*) into v_count
  from public.admission_assignment_rows
  where assignment_batch_id = p_assignment_batch_id and hard_valid = true;

  for v_row in
    select ar.*, ir.first_name, ir.last_name, ir.date_of_birth, ir.gender,
           ir.matricule, ir.grade_level_id, ir.orientation_number,
           c.capacity, c.school_id as class_school_id, c.grade_level_id as class_grade_level_id
    from public.admission_assignment_rows ar
    join public.admission_import_rows ir on ir.id = ar.import_row_id
    left join public.classes c on c.id = ar.class_id
    where ar.assignment_batch_id = p_assignment_batch_id
      and ar.hard_valid = true
    order by ar.position
  loop
    if v_row.class_id is null then
      raise exception 'Impossible de valider : % % n''a pas de classe.', v_row.first_name, v_row.last_name;
    end if;
    if v_row.class_school_id <> v_batch.school_id or v_row.class_grade_level_id <> v_batch.grade_level_id then
      raise exception 'La classe sélectionnée n''appartient pas au niveau ou à l''établissement attendu.';
    end if;
    if v_row.capacity is null or v_row.capacity <= 0 then
      raise exception 'La classe choisie pour % % n a pas de capacité.', v_row.first_name, v_row.last_name;
    end if;
    if (select count(*) from public.enrollments e
        where e.school_id=v_batch.school_id
          and e.academic_year_id=v_batch.academic_year_id
          and e.class_id=v_row.class_id
          and e.status in ('active','confirmed')
          and e.deleted_at is null)
       + (select count(*) from public.admission_assignment_rows x
          where x.assignment_batch_id=p_assignment_batch_id
            and x.class_id=v_row.class_id
            and x.hard_valid=true) > v_row.capacity then
      raise exception 'La capacité de la classe est dépassée pour % %.', v_row.first_name, v_row.last_name;
    end if;

    insert into public.pre_enrollments(
      school_id, first_name, last_name, date_of_birth, grade_level_id,
      guardian_phone, code, status, expires_at, import_row_id, suggested_class_id, source,
      created_at, updated_at
    )
    values (
      v_batch.school_id,
      v_row.first_name,
      v_row.last_name,
      coalesce(v_row.date_of_birth, current_date),
      v_row.grade_level_id,
      '0000000000',
      upper(substr(replace(public.gen_random_uuid()::text, '-', ''), 1, 6)),
      'pending',
      now() + interval '72 hours',
      v_row.import_row_id,
      v_row.class_id,
      'ministere',
      now(),
      now()
    );

    v_created := v_created + 1;
  end loop;

  update public.admission_assignment_batches
     set status = 'committed', updated_at = now()
   where id = p_assignment_batch_id;

  return jsonb_build_object(
    'created', v_created,
    'updated', 0,
    'assigned_rows', v_count,
    'status', 'committed'
  );
end;
$$;

revoke execute on function public.commit_admission_assignment(uuid) from public, anon;
grant execute on function public.commit_admission_assignment(uuid) to authenticated;

comment on function public.commit_admission_assignment(uuid) is
  'Valide une prévisualisation d affectation et crée les dossiers pré-inscription correspondants.';
