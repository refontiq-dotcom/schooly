-- ============================================================================
-- 20260917000001 — Alignement inscription confirmée + Trouvetou
-- ----------------------------------------------------------------------------
-- 1. handle_enrollment_confirmed : colonnes mutalisées (event_id / tenant_id)
--    via record_billable_event. L'ancien INSERT ciblait enrollment_id/school_id
--    qui n'existent plus après 20260911000000_billing_mutualise.
-- 2. finalize_reservation : date_of_birth (pas birth_date) et année en_cours
--    (enum academic_year_status, pas 'active').
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_enrollment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
    INSERT INTO public.platform_fee_ledger (
      product_id, event_id, tenant_id, event_type, amount,
      status, academic_year_id
    )
    SELECT
      'schooly',
      NEW.id,
      NEW.school_id,
      'enrollment_confirmed',
      COALESCE(
        (SELECT event_amount FROM public.billing_configs WHERE product_id = 'schooly' AND is_active LIMIT 1),
        1000
      ),
      'due',
      NEW.academic_year_id
    ON CONFLICT (product_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_confirmed_fee ON public.enrollments;
CREATE TRIGGER trg_enrollment_confirmed_fee
  AFTER INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_enrollment_confirmed();

CREATE OR REPLACE FUNCTION public.finalize_reservation(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res record;
  v_guardian_id uuid;
  v_student_id uuid;
  v_year_id uuid;
  v_first_name text;
  v_last_name text;
BEGIN
  SELECT * INTO v_res FROM public.trouvetou_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_res.status <> 'reserved' THEN RETURN false; END IF;

  SELECT id INTO v_year_id
  FROM public.academic_years
  WHERE school_id = v_res.school_id AND status = 'en_cours'
  LIMIT 1;

  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'Aucune année académique en cours pour cet établissement.';
  END IF;

  SELECT id INTO v_guardian_id FROM public.guardians WHERE phone = v_res.parent_phone LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.guardians (full_name, phone, email)
    VALUES (v_res.parent_full_name, v_res.parent_phone, v_res.parent_email)
    RETURNING id INTO v_guardian_id;
  END IF;

  v_first_name := split_part(v_res.student_full_name, ' ', 1);
  v_last_name := nullif(trim(substring(v_res.student_full_name from position(' ' in v_res.student_full_name) + 1)), '');
  IF v_last_name IS NULL THEN
    v_last_name := v_first_name;
  END IF;

  INSERT INTO public.students (school_id, first_name, last_name, date_of_birth)
  VALUES (v_res.school_id, v_first_name, v_last_name, v_res.student_birthdate)
  RETURNING id INTO v_student_id;

  INSERT INTO public.enrollments (
    school_id, student_id, guardian_id, grade_level_id, academic_year_id, status, enrollment_date
  ) VALUES (
    v_res.school_id, v_student_id, v_guardian_id, v_res.grade_level_id, v_year_id, 'confirmed', current_date
  );

  UPDATE public.trouvetou_reservations SET status = 'confirmed' WHERE id = p_reservation_id;

  RETURN true;
END;
$$;
