-- Import TRF sur autorisation explicite de la direction source.
-- Aucun quitus automatique : la direction atteste sa vérification dans le motif.
-- ORT et copie des bulletins/paiements exclus de cette étape.
begin;
create table public.student_movement_destinations (
  request_id uuid primary key references public.student_movement_activations(request_id),
  school_from uuid not null references public.schools(id),
  school_to uuid not null references public.schools(id),
  authorized_by uuid not null references public.users(id),
  authorized_at timestamptz not null default now(),
  authorization_reason text not null check (length(trim(authorization_reason)) between 10 and 1000),
  check (school_from <> school_to)
);
create table public.student_movement_imports (
  request_id uuid primary key references public.student_movement_destinations(request_id),
  school_from uuid not null references public.schools(id),
  school_to uuid not null references public.schools(id),
  enrollment_from uuid not null unique references public.enrollments(id),
  enrollment_to uuid not null unique references public.enrollments(id),
  imported_by uuid not null references public.users(id),
  imported_at timestamptz not null default now()
);
alter table public.student_movement_destinations enable row level security;
alter table public.student_movement_imports enable row level security;
revoke all on public.student_movement_destinations, public.student_movement_imports from public, anon, authenticated;
grant select on public.student_movement_destinations, public.student_movement_imports to authenticated;
create policy movement_destination_read on public.student_movement_destinations for select to authenticated
 using (public.has_school_role(school_from,array['direction','super_admin']) or public.has_school_role(school_to,array['direction','super_admin']));
create policy movement_import_read on public.student_movement_imports for select to authenticated
 using (public.has_school_role(school_from,array['direction','super_admin']) or public.has_school_role(school_to,array['direction','super_admin']));

create function public.authorize_student_movement_destination(p_school_from uuid, p_request_id uuid, p_school_to uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.student_movement_requests;
begin
 if auth.uid() is null or not public.has_school_role(p_school_from,array['direction','super_admin']) then
   raise exception 'Autorisation réservée à la direction source.' using errcode='42501';
 end if;
 select * into r from public.student_movement_requests where id=p_request_id and school_id=p_school_from for update;
 if not found or r.kind <> 'TRF' then raise exception 'Demande TRF indisponible.'; end if;
 if not exists(select 1 from public.student_movement_activations where request_id=r.id and expires_at > clock_timestamp()) then
   raise exception 'Activation absente ou expirée.';
 end if;
 if p_school_to is null or p_school_to=p_school_from or not exists(select 1 from public.schools where id=p_school_to and deleted_at is null) then
   raise exception 'Établissement destinataire invalide.';
 end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then
   raise exception 'Motif de validation administrative et financière requis.';
 end if;
 insert into public.student_movement_destinations(request_id,school_from,school_to,authorized_by,authorization_reason)
 values(r.id,p_school_from,p_school_to,auth.uid(),trim(p_reason));
end $$;
revoke all on function public.authorize_student_movement_destination(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.authorize_student_movement_destination(uuid,uuid,uuid,text) to authenticated;

-- Import effectif : la direction source a autorisé nommément l'école destinataire.
-- Une nouvelle inscription est créée ; l'inscription source est conservée en 'transferred'.
-- Les notes, paiements et bulletins restent dans l'école d'origine.
create function public.consume_student_movement(
  p_tracking_code text, p_school_to uuid, p_class_id uuid, p_academic_year_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.student_movement_requests;
  e public.enrollments;
  a public.student_movement_activations;
  level_id uuid;
  new_student uuid;
  new_enrollment uuid;
begin
  if auth.uid() is null or not public.has_school_role(p_school_to,array['direction','super_admin']) then
    raise exception 'Import réservé à la direction de l''établissement d''accueil.' using errcode='42501';
  end if;
  select * into r from public.student_movement_requests where tracking_code=p_tracking_code for update;
  if not found then raise exception 'Code de mouvement inconnu.'; end if;
  if r.kind <> 'TRF' then raise exception 'L''import ORT n''est pas disponible.'; end if;
  select * into a from public.student_movement_activations where request_id=r.id;
  if not found then raise exception 'Mouvement non activé par la direction source.'; end if;
  if clock_timestamp() >= a.expires_at then raise exception 'Code de mouvement expiré.'; end if;
  if not exists(select 1 from public.student_movement_destinations d
    where d.request_id=r.id and d.school_to=p_school_to) then
    raise exception 'Établissement d''accueil non autorisé par la direction source.' using errcode='42501';
  end if;
  -- La clé primaire de imports garantit l'unicité ; le message explicite est plus lisible.
  if exists(select 1 from public.student_movement_imports i where i.request_id=r.id) then
    raise exception 'Ce code a déjà été utilisé.' using errcode='23505';
  end if;
  select * into e from public.enrollments where id=r.enrollment_id and school_id=r.school_id
    and student_id=r.student_id and status='active' and deleted_at is null for update;
  if not found then raise exception 'Inscription source inactive ou déjà transférée.'; end if;
  select c.grade_level_id into level_id from public.classes c
    where c.id=p_class_id and c.school_id=p_school_to and c.deleted_at is null for share;
  if not found then raise exception 'Classe d''accueil invalide.'; end if;
  perform 1 from public.academic_years y
    where y.id=p_academic_year_id and y.school_id=p_school_to for share;
  if not found then raise exception 'Année scolaire d''accueil invalide.'; end if;

  insert into public.students(school_id,first_name,last_name,date_of_birth,
    birth_certificate_number,gender,address,photo_url)
  select p_school_to,s.first_name,s.last_name,s.date_of_birth,s.birth_certificate_number,
    s.gender,s.address,s.photo_url
  from public.students s where s.id=r.student_id
  returning id into new_student;

  insert into public.enrollments(school_id,student_id,guardian_id,grade_level_id,class_id,
    academic_year_id,enrollment_date,status)
  values(p_school_to,new_student,e.guardian_id,level_id,p_class_id,p_academic_year_id,current_date,'active')
  returning id into new_enrollment;

  update public.enrollments set status='transferred' where id=e.id;
  insert into public.student_movement_imports(request_id,school_from,school_to,
    enrollment_from,enrollment_to,imported_by)
  values(r.id,r.school_id,p_school_to,e.id,new_enrollment,auth.uid());
  return new_enrollment;
end $$;
revoke all on function public.consume_student_movement(text,uuid,uuid,uuid) from public, anon;
grant execute on function public.consume_student_movement(text,uuid,uuid,uuid) to authenticated;
commit;
