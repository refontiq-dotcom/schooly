-- Role Informatique / Administration Schooly
-- Délégation : configuration + emploi du temps + préparation/contrôle administratif.
-- Les décisions sensibles restent à la Direction.

-- L'emploi du temps est administré par la direction ou l'informatique.
drop policy if exists course_sessions_direction_write on public.course_sessions;
create policy course_sessions_admin_write on public.course_sessions for all
  using (
    is_super_admin()
    or has_school_role(school_id, array['direction','informatique','super_admin'])
  )
  with check (
    is_super_admin()
    or has_school_role(school_id, array['direction','informatique','super_admin'])
  );

-- Les bulletins restent une opération de génération/administration :
-- l'informatique peut préparer/valider la production, sans modifier les notes.
drop policy if exists report_cards_direction_write on public.report_cards;
create policy report_cards_admin_write on public.report_cards for all
  using (
    is_super_admin()
    or has_school_role(school_id, array['direction','informatique','super_admin'])
  )
  with check (
    is_super_admin()
    or has_school_role(school_id, array['direction','informatique','super_admin'])
  );
