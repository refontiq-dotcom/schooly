-- SCHOOLY — Physical enrollment documents are a checklist only.
-- No scan, upload or file URL is required at the counter.

ALTER TABLE public.enrollment_documents
  DROP CONSTRAINT IF EXISTS enrollment_documents_status_check;

UPDATE public.enrollment_documents
SET status = CASE
  WHEN status IN ('submitted', 'validated') THEN 'provided'
  ELSE 'missing'
END;

ALTER TABLE public.enrollment_documents
  ADD CONSTRAINT enrollment_documents_status_check
  CHECK (status IN ('missing', 'provided'));

ALTER TABLE public.enrollment_documents
  DROP COLUMN IF EXISTS file_url;

CREATE OR REPLACE FUNCTION public.compute_enrollment_intelligence(p_application_id uuid)
RETURNS public.enrollment_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.enrollment_applications;
  flags text[] := '{}';
  risk int := 0;
  candidate public.sections;
  req_count int := 0;
  provided_count int := 0;
  score int := 0;
BEGIN
  SELECT * INTO a
  FROM public.enrollment_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier d''inscription introuvable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.establishment_id = a.establishment_id
      AND lower(trim(s.full_name)) = lower(trim(a.student_full_name))
      AND (s.birthdate = a.student_birthdate OR (s.birthdate IS NULL AND a.student_birthdate IS NULL))
  ) THEN
    flags := array_append(flags, 'DUPLICATE_STUDENT');
    risk := greatest(risk, 95);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.establishment_id = a.establishment_id
      AND r.id IS DISTINCT FROM a.reservation_id
      AND r.status IN ('pending_payment','reserved','confirmed','waitlisted')
      AND regexp_replace(coalesce(r.parent_phone,''), '\s+', '', 'g') = regexp_replace(coalesce(a.parent_phone,''), '\s+', '', 'g')
      AND lower(trim(r.student_full_name)) = lower(trim(a.student_full_name))
  ) THEN
    flags := array_append(flags, 'ACTIVE_DUPLICATE_RESERVATION');
    risk := greatest(risk, 90);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'provided')
  INTO req_count, provided_count
  FROM public.enrollment_documents
  WHERE enrollment_id = a.id;

  a.completeness_pct := CASE
    WHEN req_count = 0 THEN 100
    ELSE round(100.0 * provided_count / req_count)
  END;

  SELECT s.* INTO candidate
  FROM public.sections s
  WHERE s.level_id = a.requested_level_id
    AND s.seats_taken < s.capacity
  ORDER BY (s.seats_taken::numeric / nullif(s.capacity,0)) ASC, s.name ASC
  LIMIT 1;

  IF candidate.id IS NOT NULL THEN
    score := 100 - round(100.0 * candidate.seats_taken / greatest(candidate.capacity,1));
    a.recommended_section_id := candidate.id;
    a.recommendation_score := greatest(0, least(100, score));
    a.recommendation_reason := format('Section %s recommandée : %s/%s places occupées.', candidate.name, candidate.seats_taken, candidate.capacity);
  ELSE
    a.recommended_section_id := NULL;
    a.recommendation_score := 0;
    a.recommendation_reason := 'Aucune place disponible : le dossier peut être placé en liste d''attente.';
    flags := array_append(flags, 'NO_AVAILABLE_SEAT');
  END IF;

  UPDATE public.enrollment_applications
  SET completeness_pct = a.completeness_pct,
      duplicate_risk_score = risk,
      duplicate_flags = flags,
      recommended_section_id = a.recommended_section_id,
      recommendation_score = a.recommendation_score,
      recommendation_reason = a.recommendation_reason,
      updated_at = now()
  WHERE id = a.id;

  SELECT * INTO a FROM public.enrollment_applications WHERE id = a.id;
  RETURN a;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_enrollment_intelligence(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_enrollment_intelligence(uuid) TO service_role;
