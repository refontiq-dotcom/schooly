-- Recompute all existing dossiers after switching the checklist to missing/provided.
do $$
declare r record;
begin
  for r in select id from public.enrollment_applications loop
    perform public.compute_enrollment_intelligence(r.id);
  end loop;
end $$;
