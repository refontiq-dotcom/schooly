-- Smart enrollment RPCs are server-side orchestration endpoints.
revoke all on function public.create_enrollment_application_from_reservation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_enrollment_application_from_reservation(uuid,uuid) to service_role;

revoke all on function public.compute_enrollment_intelligence(uuid) from public, anon, authenticated;
grant execute on function public.compute_enrollment_intelligence(uuid) to service_role;

-- Keep the staff pipeline subject to the caller's RLS context.
create or replace view public.enrollment_pipeline with (security_invoker = true) as
select ea.id,ea.establishment_id,ea.reservation_id,ea.student_id,ea.status,ea.modality,
       ea.student_full_name,ea.student_birthdate,ea.parent_full_name,ea.parent_phone,
       ea.requested_level_id,l.name requested_level_name,ea.completeness_pct,
       ea.duplicate_risk_score,ea.duplicate_flags,ea.recommended_section_id,
       rs.name recommended_section_name,ea.recommendation_score,ea.recommendation_reason,
       ea.created_at,ea.submitted_at,ea.reviewed_at
from public.enrollment_applications ea
join public.levels l on l.id=ea.requested_level_id
left join public.sections rs on rs.id=ea.recommended_section_id;

grant select on public.enrollment_pipeline to authenticated, service_role;
