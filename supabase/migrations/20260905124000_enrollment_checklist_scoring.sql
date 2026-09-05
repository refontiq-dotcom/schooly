-- The physical workflow uses a simple missing/provided checklist.
-- Keep the intelligence engine compatible with that workflow.
create or replace function public.compute_enrollment_intelligence(p_application_id uuid)
returns public.enrollment_applications
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.enrollment_applications;
  flags text[] := '{}';
  risk int := 0;
  candidate public.sections;
  req_count int := 0;
  provided_count int := 0;
  score int := 0;
begin
  select * into a from public.enrollment_applications where id=p_application_id for update;
  if not found then raise exception 'Dossier d''inscription introuvable'; end if;

  if exists (
    select 1 from public.students s
    where s.establishment_id=a.establishment_id
      and lower(trim(s.full_name))=lower(trim(a.student_full_name))
      and (s.birthdate=a.student_birthdate or (s.birthdate is null and a.student_birthdate is null))
  ) then
    flags:=array_append(flags,'DUPLICATE_STUDENT');
    risk:=greatest(risk,95);
  end if;

  if exists (
    select 1 from public.reservations r
    where r.establishment_id=a.establishment_id
      and r.id is distinct from a.reservation_id
      and r.status in ('pending_payment','reserved','confirmed','waitlisted')
      and public.normalize_schooly_phone(r.parent_phone)=public.normalize_schooly_phone(a.parent_phone)
      and lower(trim(r.student_full_name))=lower(trim(a.student_full_name))
  ) then
    flags:=array_append(flags,'ACTIVE_DUPLICATE_RESERVATION');
    risk:=greatest(risk,90);
  end if;

  if exists (
    select 1 from public.reservations r
    where r.establishment_id=a.establishment_id
      and r.id is distinct from a.reservation_id
      and public.normalize_schooly_phone(r.parent_phone)=public.normalize_schooly_phone(a.parent_phone)
      and lower(trim(r.parent_full_name))<>lower(trim(a.parent_full_name))
      and r.created_at>now()-interval '6 months'
  ) then
    flags:=array_append(flags,'PHONE_NAME_MISMATCH');
    risk:=greatest(risk,65);
  end if;

  select count(*), count(*) filter(where status='provided')
    into req_count, provided_count
  from public.enrollment_documents
  where enrollment_id=a.id;

  a.completeness_pct:=case when req_count=0 then 100 else round(100.0*provided_count/req_count) end;

  select s.* into candidate
  from public.sections s
  where s.level_id=a.requested_level_id
    and s.seats_taken<s.capacity
  order by (s.seats_taken::numeric/nullif(s.capacity,0)) asc,s.name asc
  limit 1;

  if candidate.id is not null then
    score:=100-round(100.0*candidate.seats_taken/greatest(candidate.capacity,1));
    a.recommended_section_id:=candidate.id;
    a.recommendation_score:=greatest(0,least(100,score));
    a.recommendation_reason:=format('Section %s recommandée : %s/%s places occupées.',candidate.name,candidate.seats_taken,candidate.capacity);
  else
    a.recommended_section_id:=null;
    a.recommendation_score:=0;
    a.recommendation_reason:='Aucune place disponible : le dossier peut être placé en liste d''attente.';
    flags:=array_append(flags,'NO_AVAILABLE_SEAT');
  end if;

  update public.enrollment_applications
  set completeness_pct=a.completeness_pct,
      duplicate_risk_score=risk,
      duplicate_flags=flags,
      recommended_section_id=a.recommended_section_id,
      recommendation_score=a.recommendation_score,
      recommendation_reason=a.recommendation_reason,
      updated_at=now()
  where id=a.id;

  select * into a from public.enrollment_applications where id=a.id;
  return a;
end;
$$;

revoke all on function public.compute_enrollment_intelligence(uuid) from public, anon, authenticated;
grant execute on function public.compute_enrollment_intelligence(uuid) to service_role;
