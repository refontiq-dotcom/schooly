-- SCHOOLY — Smart Enrollment / Admissions
-- Extends the existing reservation, student, modality and document systems.

do $$ begin
  create type enrollment_application_status as enum (
    'draft','submitted','under_review','incomplete','waitlisted','approved','rejected','cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.enrollment_applications (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  reservation_id uuid unique references public.reservations(id) on delete set null,
  student_id uuid unique references public.students(id) on delete set null,
  applicant_id uuid references public.profiles(id) on delete set null,
  requested_level_id uuid not null references public.levels(id),
  requested_section_id uuid references public.sections(id),
  modality inscription_modality not null default 'standard',
  status enrollment_application_status not null default 'draft',
  student_full_name text not null,
  student_birthdate date,
  parent_full_name text not null,
  parent_phone text not null,
  parent_email text,
  previous_school text,
  previous_level text,
  school_year text,
  completeness_pct int not null default 0 check (completeness_pct between 0 and 100),
  duplicate_risk_score int not null default 0 check (duplicate_risk_score between 0 and 100),
  duplicate_flags text[] not null default '{}',
  recommended_section_id uuid references public.sections(id),
  recommendation_score int check (recommendation_score is null or recommendation_score between 0 and 100),
  recommendation_reason text,
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollment_documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollment_applications(id) on delete cascade,
  document_type text not null,
  status text not null default 'missing' check (status in ('missing','submitted','validated','rejected')),
  file_url text,
  notes text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, document_type)
);

create index if not exists idx_enrollment_apps_establishment_status on public.enrollment_applications(establishment_id, status, created_at desc);
create index if not exists idx_enrollment_apps_parent_phone on public.enrollment_applications(establishment_id, parent_phone);
create index if not exists idx_enrollment_docs_enrollment on public.enrollment_documents(enrollment_id);

alter table public.enrollment_applications enable row level security;
alter table public.enrollment_documents enable row level security;

drop policy if exists "Staff voit les dossiers d'inscription" on public.enrollment_applications;
create policy "Staff voit les dossiers d'inscription" on public.enrollment_applications for select
  using (establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur')));

drop policy if exists "Parent voit ses dossiers d'inscription" on public.enrollment_applications;
create policy "Parent voit ses dossiers d'inscription" on public.enrollment_applications for select using (applicant_id = auth.uid());

drop policy if exists "Parent crée son dossier d'inscription" on public.enrollment_applications;
create policy "Parent crée son dossier d'inscription" on public.enrollment_applications for insert with check (applicant_id = auth.uid());

drop policy if exists "Parent met à jour son dossier" on public.enrollment_applications;
create policy "Parent met à jour son dossier" on public.enrollment_applications for update
  using (applicant_id = auth.uid() and status in ('draft','incomplete')) with check (applicant_id = auth.uid());

drop policy if exists "Staff gère les dossiers d'inscription" on public.enrollment_applications;
create policy "Staff gère les dossiers d'inscription" on public.enrollment_applications for update
  using (establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur')))
  with check (establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur')));

drop policy if exists "Staff voit les documents d'inscription" on public.enrollment_documents;
create policy "Staff voit les documents d'inscription" on public.enrollment_documents for select
  using (enrollment_id in (select id from public.enrollment_applications where establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur'))));

drop policy if exists "Parent voit ses documents d'inscription" on public.enrollment_documents;
create policy "Parent voit ses documents d'inscription" on public.enrollment_documents for select
  using (enrollment_id in (select id from public.enrollment_applications where applicant_id = auth.uid()));

drop policy if exists "Parent ajoute ses documents d'inscription" on public.enrollment_documents;
create policy "Parent ajoute ses documents d'inscription" on public.enrollment_documents for insert
  with check (enrollment_id in (select id from public.enrollment_applications where applicant_id = auth.uid() and status in ('draft','incomplete')));

drop policy if exists "Staff valide les documents d'inscription" on public.enrollment_documents;
create policy "Staff valide les documents d'inscription" on public.enrollment_documents for update
  using (enrollment_id in (select id from public.enrollment_applications where establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur'))))
  with check (enrollment_id in (select id from public.enrollment_applications where establishment_id in (select establishment_id from public.my_profile() where role in ('admin','secretariat','censeur'))));

create or replace function public.create_enrollment_application_from_reservation(p_reservation_id uuid, p_applicant_id uuid default null)
returns public.enrollment_applications language plpgsql security definer set search_path = public as $$
declare r public.reservations; a public.enrollment_applications; req text;
begin
  select * into r from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  select * into a from public.enrollment_applications where reservation_id=p_reservation_id;
  if found then return a; end if;
  insert into public.enrollment_applications (
    establishment_id,reservation_id,applicant_id,requested_level_id,requested_section_id,modality,status,
    student_full_name,student_birthdate,parent_full_name,parent_phone,parent_email,school_year,submitted_at
  ) values (
    r.establishment_id,r.id,p_applicant_id,r.level_id,r.section_id,coalesce(r.modality,'standard'::inscription_modality),
    case when r.status='waitlisted' then 'waitlisted'::enrollment_application_status else 'submitted'::enrollment_application_status end,
    r.student_full_name,r.student_birthdate,r.parent_full_name,r.parent_phone,r.parent_email,
    extract(year from current_date)::text || '-' || extract(year from current_date + interval '1 year')::text,now()
  ) returning * into a;
  for req in select unnest(coalesce((select required_documents from public.inscription_modalities where establishment_id=r.establishment_id and modality=r.modality and is_active),'{}')) loop
    insert into public.enrollment_documents(enrollment_id,document_type,status) values(a.id,req,'missing') on conflict do nothing;
  end loop;
  return a;
end; $$;

grant execute on function public.create_enrollment_application_from_reservation(uuid,uuid) to authenticated, anon;

create or replace function public.compute_enrollment_intelligence(p_application_id uuid)
returns public.enrollment_applications language plpgsql security definer set search_path=public as $$
declare
  a public.enrollment_applications; flags text[]:='{}'; risk int:=0; candidate public.sections;
  req_count int:=0; validated_count int:=0; score int:=0;
begin
  select * into a from public.enrollment_applications where id=p_application_id for update;
  if not found then raise exception 'Dossier d''inscription introuvable'; end if;

  if exists (select 1 from public.students s where s.establishment_id=a.establishment_id and lower(trim(s.full_name))=lower(trim(a.student_full_name)) and (s.birthdate=a.student_birthdate or (s.birthdate is null and a.student_birthdate is null))) then
    flags:=array_append(flags,'DUPLICATE_STUDENT'); risk:=greatest(risk,95);
  end if;
  if exists (select 1 from public.reservations r where r.establishment_id=a.establishment_id and r.id is distinct from a.reservation_id and r.status in ('pending_payment','reserved','confirmed','waitlisted') and regexp_replace(coalesce(r.parent_phone,''),'\\s+','','g')=regexp_replace(coalesce(a.parent_phone,''),'\\s+','','g') and lower(trim(r.student_full_name))=lower(trim(a.student_full_name))) then
    flags:=array_append(flags,'ACTIVE_DUPLICATE_RESERVATION'); risk:=greatest(risk,90);
  end if;
  if exists (select 1 from public.reservations r where r.establishment_id=a.establishment_id and r.id is distinct from a.reservation_id and regexp_replace(coalesce(r.parent_phone,''),'\\s+','','g')=regexp_replace(coalesce(a.parent_phone,''),'\\s+','','g') and lower(trim(r.parent_full_name))<>lower(trim(a.parent_full_name)) and r.created_at>now()-interval '6 months') then
    flags:=array_append(flags,'PHONE_NAME_MISMATCH'); risk:=greatest(risk,65);
  end if;

  select count(*),count(*) filter(where status='validated') into req_count,validated_count from public.enrollment_documents where enrollment_id=a.id;
  a.completeness_pct:=case when req_count=0 then 100 else round(100.0*validated_count/req_count) end;

  select s.* into candidate from public.sections s where s.level_id=a.requested_level_id and s.seats_taken<s.capacity order by (s.seats_taken::numeric/nullif(s.capacity,0)) asc,s.name asc limit 1;
  if candidate.id is not null then
    score:=100-round(100.0*candidate.seats_taken/greatest(candidate.capacity,1));
    a.recommended_section_id:=candidate.id; a.recommendation_score:=greatest(0,least(100,score));
    a.recommendation_reason:=format('Section %s recommandée : %s/%s places occupées.',candidate.name,candidate.seats_taken,candidate.capacity);
  else
    a.recommended_section_id:=null; a.recommendation_score:=0; a.recommendation_reason:='Aucune place disponible : le dossier peut être placé en liste d''attente.';
    flags:=array_append(flags,'NO_AVAILABLE_SEAT');
  end if;

  a.duplicate_flags:=flags; a.duplicate_risk_score:=risk; a.updated_at:=now();
  update public.enrollment_applications set completeness_pct=a.completeness_pct,duplicate_risk_score=a.duplicate_risk_score,duplicate_flags=a.duplicate_flags,recommended_section_id=a.recommended_section_id,recommendation_score=a.recommendation_score,recommendation_reason=a.recommendation_reason,updated_at=now() where id=a.id;
  select * into a from public.enrollment_applications where id=a.id; return a;
end; $$;

grant execute on function public.compute_enrollment_intelligence(uuid) to authenticated;

-- Prevent the existing finalize path from counting a seat twice: reserved already holds one.
create or replace function public.finalize_reservation(p_reservation_id uuid,p_section_id uuid default null,p_actor_id uuid default null)
returns table(reservation_id uuid,student_id uuid,section_id uuid) language plpgsql security definer set search_path=public as $$
declare v_res record; v_section_id uuid; v_student_id uuid; needs_increment boolean;
begin
  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation % not found',p_reservation_id; end if;
  if v_res.status not in ('pending_payment','reserved') then raise exception 'Reservation % cannot be finalized (status=%)',p_reservation_id,v_res.status; end if;
  v_section_id:=coalesce(p_section_id,v_res.section_id); needs_increment:=(v_res.status='pending_payment');
  if v_section_id is null then
    select s.id into v_section_id from public.sections s where s.level_id=v_res.level_id and s.seats_taken<s.capacity order by (s.seats_taken::numeric/nullif(s.capacity,0)) asc,s.name asc limit 1;
    needs_increment:=true;
  end if;
  if v_section_id is null then raise exception 'No section available for level %',v_res.level_id; end if;
  if needs_increment then
    perform 1 from public.sections where id=v_section_id and seats_taken<capacity for update;
    if not found then raise exception 'Section % is full',v_section_id; end if;
  end if;
  insert into public.students(reservation_id,establishment_id,section_id,full_name,birthdate,parent_phone)
    values(v_res.id,v_res.establishment_id,v_section_id,v_res.student_full_name,v_res.student_birthdate,coalesce(v_res.parent_phone,'')) returning id into v_student_id;
  if needs_increment then update public.sections set seats_taken=seats_taken+1 where id=v_section_id; end if;
  update public.reservations set status='confirmed',section_id=v_section_id,confirmed_at=now(),confirmed_by=p_actor_id where id=p_reservation_id;
  update public.enrollment_applications set student_id=v_student_id,requested_section_id=v_section_id,status='approved',approved_at=now(),reviewed_by=p_actor_id,reviewed_at=now(),updated_at=now() where reservation_id=p_reservation_id;
  return query select p_reservation_id,v_student_id,v_section_id;
end; $$;

grant execute on function public.finalize_reservation(uuid,uuid,uuid) to authenticated,service_role;

create or replace view public.enrollment_pipeline as
select ea.id,ea.establishment_id,ea.reservation_id,ea.student_id,ea.status,ea.modality,ea.student_full_name,ea.student_birthdate,ea.parent_full_name,ea.parent_phone,ea.requested_level_id,l.name requested_level_name,ea.completeness_pct,ea.duplicate_risk_score,ea.duplicate_flags,ea.recommended_section_id,rs.name recommended_section_name,ea.recommendation_score,ea.recommendation_reason,ea.created_at,ea.submitted_at,ea.reviewed_at
from public.enrollment_applications ea join public.levels l on l.id=ea.requested_level_id left join public.sections rs on rs.id=ea.recommended_section_id;

grant select on public.enrollment_pipeline to authenticated;
