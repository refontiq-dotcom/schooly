-- Backfill the intelligent dossier for reservations already present in Schooly.
insert into public.enrollment_applications (
  establishment_id,reservation_id,applicant_id,requested_level_id,requested_section_id,
  modality,status,student_full_name,student_birthdate,parent_full_name,parent_phone,parent_email,
  school_year,submitted_at
)
select
  r.establishment_id,
  r.id,
  p.id,
  r.level_id,
  r.section_id,
  coalesce(r.modality,'standard'::inscription_modality),
  case
    when r.status='confirmed' then 'approved'::enrollment_application_status
    when r.status='waitlisted' then 'waitlisted'::enrollment_application_status
    when r.status='cancelled' then 'cancelled'::enrollment_application_status
    else 'submitted'::enrollment_application_status
  end,
  r.student_full_name,r.student_birthdate,r.parent_full_name,r.parent_phone,r.parent_email,
  extract(year from r.created_at)::text || '-' || extract(year from r.created_at + interval '1 year')::text,
  r.created_at
from public.reservations r
left join lateral (
  select pr.id
  from public.profiles pr
  where pr.role='parent'
    and ((r.parent_email is not null and pr.email is not null and lower(pr.email)=lower(r.parent_email))
      or (r.parent_phone is not null and pr.phone is not null and regexp_replace(pr.phone,'\\s+','','g')=regexp_replace(r.parent_phone,'\\s+','','g')))
  order by case when r.parent_email is not null and pr.email is not null and lower(pr.email)=lower(r.parent_email) then 0 else 1 end
  limit 1
) p on true
where r.status <> 'rejected_fraud'
on conflict (reservation_id) do nothing;

insert into public.enrollment_documents(enrollment_id,document_type,status)
select ea.id, req.doc_type, 'missing'
from public.enrollment_applications ea
join public.inscription_modalities im on im.establishment_id=ea.establishment_id and im.modality=ea.modality and im.is_active
cross join lateral unnest(coalesce(im.required_documents,'{}')) req(doc_type)
on conflict (enrollment_id,document_type) do nothing;

-- Score the backfilled dossiers once so the dashboard is immediately useful.
do $$
declare r record;
begin
  for r in select id from public.enrollment_applications loop
    perform public.compute_enrollment_intelligence(r.id);
  end loop;
end $$;
