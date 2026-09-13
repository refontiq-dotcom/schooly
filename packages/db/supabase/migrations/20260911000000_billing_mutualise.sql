-- ============================================================================
-- Migration : Ajout tables mutualisées @refontiq/billing à Schooly
-- Ajoute : billing_configs, subscription_payment_requests
-- Adapte : platform_fee_ledger, platform_invoices (product_id, tenant_id)
-- Fonctions : validate_subscription_payment, reject_subscription_payment,
--              record_billable_event, generate_platform_invoices, mark_fees_collected
-- ============================================================================

-- ─── 1. billing_configs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('subscription_tiers', 'event_based')),
  currency TEXT NOT NULL DEFAULT 'XOF',
  tiers JSONB DEFAULT '[]'::jsonb,
  event_amount BIGINT DEFAULT 1000,
  event_types JSONB DEFAULT '[]'::jsonb,
  wave_merchant_id TEXT,
  wave_webhook_secret TEXT,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  telegram_admin_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_configs_product ON public.billing_configs (product_id);

-- ─── 2. subscription_payment_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  subscription_id UUID,
  tier_id TEXT,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'rejected', 'cancelled')),
  requested_by UUID,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  sender_phone TEXT,
  payment_provider TEXT DEFAULT 'wave'
    CHECK (payment_provider IN ('wave', 'orange_money', 'mtn_money', 'moov_money', 'pi_spi', 'manual')),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spr_product ON public.subscription_payment_requests (product_id);
CREATE INDEX IF NOT EXISTS idx_spr_tenant ON public.subscription_payment_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spr_status ON public.subscription_payment_requests (status);
CREATE INDEX IF NOT EXISTS idx_spr_created ON public.subscription_payment_requests (created_at DESC);

-- ─── 3. Adapter platform_fee_ledger (ajouter product_id + tenant_id) ─────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_fee_ledger' AND column_name = 'product_id') THEN
    ALTER TABLE public.platform_fee_ledger ADD COLUMN product_id TEXT NOT NULL DEFAULT 'schooly';
    ALTER TABLE public.platform_fee_ledger ADD COLUMN event_type TEXT DEFAULT 'enrollment_confirmed';
    ALTER TABLE public.platform_fee_ledger ADD COLUMN period_label TEXT;
    ALTER TABLE public.platform_fee_ledger ADD COLUMN period_start DATE;
    ALTER TABLE public.platform_fee_ledger ADD COLUMN period_end DATE;

    -- Renommer les colonnes (school_id → tenant_id, enrollment_id → event_id)
    ALTER TABLE public.platform_fee_ledger RENAME COLUMN school_id TO tenant_id;
    ALTER TABLE public.platform_fee_ledger RENAME COLUMN enrollment_id TO event_id;

    -- Nouvelle contrainte unique
    ALTER TABLE public.platform_fee_ledger DROP CONSTRAINT IF EXISTS platform_fee_ledger_enrollment_id_key;
    ALTER TABLE public.platform_fee_ledger ADD CONSTRAINT platform_fee_ledger_product_event_unique UNIQUE (product_id, event_id);

    -- Nouveaux index
    CREATE INDEX IF NOT EXISTS idx_pfl_product ON public.platform_fee_ledger (product_id);
    CREATE INDEX IF NOT EXISTS idx_pfl_event ON public.platform_fee_ledger (event_id);
  END IF;
END $$;

-- ─── 4. Adapter platform_invoices (ajouter product_id + tenant_id) ───────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_invoices' AND column_name = 'product_id') THEN
    ALTER TABLE public.platform_invoices ADD COLUMN product_id TEXT NOT NULL DEFAULT 'schooly';
    ALTER TABLE public.platform_invoices RENAME COLUMN school_id TO tenant_id;

    ALTER TABLE public.platform_invoices DROP CONSTRAINT IF EXISTS platform_invoices_school_id_period_label_key;
    ALTER TABLE public.platform_invoices ADD CONSTRAINT platform_invoices_product_tenant_period_unique UNIQUE (product_id, tenant_id, period_label);

    CREATE INDEX IF NOT EXISTS idx_pi_product ON public.platform_invoices (product_id);
    CREATE INDEX IF NOT EXISTS idx_pi_tenant ON public.platform_invoices (tenant_id);
  END IF;
END $$;

-- ─── 5. Triggers updated_at ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_billing_configs_updated ON public.billing_configs;
CREATE TRIGGER trg_billing_configs_updated BEFORE UPDATE ON public.billing_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_spr_updated ON public.subscription_payment_requests;
CREATE TRIGGER trg_spr_updated BEFORE UPDATE ON public.subscription_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 6. Fonction : validate_subscription_payment ──────────────────────────
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

-- ─── 7. Fonction : reject_subscription_payment ─────────────────────────────
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

-- ─── 8. Fonction : record_billable_event ───────────────────────────────────
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

-- ─── 9. Fonction : generate_platform_invoices ──────────────────────────────
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

-- ─── 10. Fonction : mark_fees_collected ─────────────────────────────────────
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

-- ─── 11. RLS pour nouvelles tables ──────────────────────────────────────────
ALTER TABLE public.billing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_configs_read ON public.billing_configs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY spr_service_role ON public.subscription_payment_requests FOR ALL USING (true);

-- ─── 12. Insérer la config Schooly ──────────────────────────────────────────
INSERT INTO public.billing_configs (
  product_id, name, mode, currency, event_amount, event_types,
  wave_merchant_id, wave_webhook_secret,
  telegram_bot_token, telegram_chat_id, telegram_admin_url,
  is_active
) VALUES (
  'schooly',
  'Schooly',
  'event_based',
  'XOF',
  1000,
  '["enrollment_confirmed"]'::jsonb,
  'M_ci_RImDyQYI8ccj',
  '',
  '8882268453:AAGNSyYytK2Wyo57sKAlw2Vps1HNBg11ZvE',
  '8958821599',
  'https://admin.schooly.ci/billing',
  true
)
ON CONFLICT (product_id) DO UPDATE SET
  name = EXCLUDED.name,
  mode = EXCLUDED.mode,
  currency = EXCLUDED.currency,
  event_amount = EXCLUDED.event_amount,
  event_types = EXCLUDED.event_types,
  wave_merchant_id = EXCLUDED.wave_merchant_id,
  telegram_bot_token = EXCLUDED.telegram_bot_token,
  telegram_chat_id = EXCLUDED.telegram_chat_id,
  telegram_admin_url = EXCLUDED.telegram_admin_url,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

SELECT product_id, name, mode, event_amount FROM public.billing_configs;
