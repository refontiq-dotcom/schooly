-- ============================================================================
-- Migration : Billing mutualisé — durcissement RLS + autorisation des RPC
-- ----------------------------------------------------------------------------
-- Problème corrigé :
--   1. Policy `spr_service_role ... FOR ALL USING (true)` laissait TOUT rôle
--      (y compris anon/authenticated via PostgREST) lire/écrire l'intégralité
--      de subscription_payment_requests : levée de cloisonnement inter-écoles.
--   2. Les RPC validate/reject/record_billable_event/generate_platform_invoices
--      étaient exécutables par n'importe quel client `authenticated` sans
--      vérification : un élève/parent authentifié pouvait valider/rejeter une
--      demande d'une autre école.
--
-- Correctif :
--   * Policies RLS cloisonnées par école (membres + super_admin) : SELECT et
--     INSERT bornés à la/les écoles de l'utilisateur (user_school_roles actif).
--   * Garde-fou interne dans les 5 RPC : autorisation uniquement si le
--     call est `service_role` (flux serveur des Server Actions / package
--     @refontiq/billing) ou si le caller authentifié est super_admin.
--   * EXECUTE retiré de PUBLIC, accordé à authenticated + service_role.
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

-- ─── 1. RLS subscription_payment_requests : policies cloisonnées ────────────

DROP POLICY IF EXISTS spr_service_role ON public.subscription_payment_requests;

DROP POLICY IF EXISTS spr_member_read ON public.subscription_payment_requests;
CREATE POLICY spr_member_read ON public.subscription_payment_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id = ANY (
      SELECT school_id
      FROM public.user_school_roles
      WHERE user_id = auth.uid() AND is_active
    )
  );

DROP POLICY IF EXISTS spr_member_insert ON public.subscription_payment_requests;
CREATE POLICY spr_member_insert ON public.subscription_payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = ANY (
      SELECT school_id
      FROM public.user_school_roles
      WHERE user_id = auth.uid() AND is_active
    )
  );

-- ─── 2. Helper d'autorisation interne (service_role OU super_admin) ─────────

CREATE OR REPLACE FUNCTION public.billing_rpc_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );
$$;

-- ─── 3. validate_subscription_payment (garde-fou + re-création) ──────────────

CREATE OR REPLACE FUNCTION public.validate_subscription_payment(
  p_request_id UUID,
  p_validator_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  tenant_id UUID,
  amount BIGINT,
  status TEXT,
  validated_by UUID,
  validated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.subscription_payment_requests%ROWTYPE;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut valider un paiement';
  END IF;

  SELECT * INTO v_request
  FROM public.subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;

  UPDATE public.subscription_payment_requests
  SET
    status = 'validated',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY SELECT
    v_request.id, v_request.product_id, v_request.tenant_id, v_request.amount,
    'validated'::TEXT, p_validator_id, NOW()::TIMESTAMPTZ;
END;
$$;
-- ─── 4. reject_subscription_payment (garde-fou + re-création) ────────────────

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_request_id UUID,
  p_validator_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  tenant_id UUID,
  amount BIGINT,
  status TEXT,
  validated_by UUID,
  validated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.subscription_payment_requests%ROWTYPE;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Seul le Super Admin peut rejeter un paiement';
  END IF;

  SELECT * INTO v_request
  FROM public.subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;

  UPDATE public.subscription_payment_requests
  SET
    status = 'rejected',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY SELECT
    v_request.id, v_request.product_id, v_request.tenant_id, v_request.amount,
    'rejected'::TEXT, p_validator_id, NOW()::TIMESTAMPTZ;
END;
$$;

-- ─── 5. record_billable_event (garde-fou + re-création) ─────────────────────

CREATE OR REPLACE FUNCTION public.record_billable_event(
  p_product_id TEXT,
  p_event_id UUID,
  p_tenant_id UUID,
  p_event_type TEXT,
  p_amount BIGINT DEFAULT NULL,
  p_academic_year_id UUID DEFAULT NULL,
  p_period_label TEXT DEFAULT NULL,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  event_id UUID,
  tenant_id UUID,
  event_type TEXT,
  amount BIGINT,
  status TEXT,
  period_label TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_amount BIGINT;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  SELECT INTO v_config *
  FROM public.billing_configs
  WHERE product_id = p_product_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: Configuration produit introuvable';
  END IF;

  v_amount := COALESCE(p_amount, v_config.event_amount);

  INSERT INTO public.platform_fee_ledger (
    product_id, event_id, tenant_id, event_type, amount,
    status, academic_year_id, period_label, period_start, period_end
  ) VALUES (
    p_product_id, p_event_id, p_tenant_id, p_event_type, v_amount,
    'due', p_academic_year_id, p_period_label, p_period_start, p_period_end
  )
  ON CONFLICT (product_id, event_id) DO NOTHING;

  RETURN QUERY
  SELECT id, product_id, event_id, tenant_id, event_type, amount, status, period_label, created_at
  FROM public.platform_fee_ledger
  WHERE product_id = p_product_id AND event_id = p_event_id;
END;
$$;

-- ─── 6. generate_platform_invoices (garde-fou + re-création) ────────────────

CREATE OR REPLACE FUNCTION public.generate_platform_invoices(
  p_product_id TEXT,
  p_period_label TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS SETOF public.platform_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  INSERT INTO public.platform_invoices (
    product_id, tenant_id, academic_year_id,
    period_label, period_start, period_end,
    total_events, total_due, status
  )
  SELECT
    p_product_id,
    pfl.tenant_id,
    pfl.academic_year_id,
    p_period_label,
    p_period_start,
    p_period_end,
    COUNT(*)::INTEGER as total_events,
    SUM(pfl.amount) as total_due,
    'pending'::TEXT
  FROM public.platform_fee_ledger pfl
  WHERE pfl.product_id = p_product_id
    AND pfl.status IN ('due', 'collected')
    AND pfl.created_at >= p_period_start
    AND pfl.created_at <= p_period_end
  GROUP BY pfl.tenant_id, pfl.academic_year_id
  ON CONFLICT (product_id, tenant_id, period_label) DO UPDATE SET
    total_events = EXCLUDED.total_events,
    total_due = EXCLUDED.total_due,
    updated_at = NOW()
  RETURNING *;
END;
$$;

-- ─── 7. mark_fees_collected (garde-fou + re-création) ───────────────────────

CREATE OR REPLACE FUNCTION public.mark_fees_collected(
  p_product_id TEXT,
  p_tenant_id UUID,
  p_period_label TEXT,
  p_paid_amount BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin';
  END IF;

  UPDATE public.platform_fee_ledger
  SET status = 'collected', updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND status = 'due'
    AND period_label = p_period_label;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.platform_invoices
  SET status = 'paid', paid_at = NOW(), paid_amount = p_paid_amount, updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND period_label = p_period_label
    AND status = 'pending';

  RETURN v_updated;
END;
$$;

-- ─── 8. EXECUTE : retirer de PUBLIC, accorder à authenticated + service_role ─

REVOKE EXECUTE ON FUNCTION public.validate_subscription_payment(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_subscription_payment(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_billable_event(TEXT, UUID, UUID, TEXT, BIGINT, UUID, TEXT, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_platform_invoices(TEXT, TEXT, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_fees_collected(TEXT, UUID, TEXT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.validate_subscription_payment(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_billable_event(TEXT, UUID, UUID, TEXT, BIGINT, UUID, TEXT, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_platform_invoices(TEXT, TEXT, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_fees_collected(TEXT, UUID, TEXT, BIGINT) TO authenticated, service_role;

-- ─── 9. Tableau récapitulatif (sortie SQL utile pour `supabase db push`) ────

SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'subscription_payment_requests'
ORDER BY policyname;

