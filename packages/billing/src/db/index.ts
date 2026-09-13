/**
 * @refontiq/billing — Export du schéma SQL
 */

export const SCHEMA_SQL = `
-- ============================================================================
-- @refontiq/billing — Schéma de Base de Données
-- Moteur de facturation mutualisé pour l'écosystème Refontiq
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. billing_configs
CREATE TABLE IF NOT EXISTS billing_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 2. subscription_payment_requests
CREATE TABLE IF NOT EXISTS subscription_payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  subscription_id UUID,
  tier_id TEXT,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'cancelled')),
  requested_by UUID,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  sender_phone TEXT,
  payment_provider TEXT DEFAULT 'wave' CHECK (payment_provider IN ('wave', 'orange_money', 'mtn_money', 'moov_money', 'pi_spi', 'manual')),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. platform_fee_ledger
CREATE TABLE IF NOT EXISTS platform_fee_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  event_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'collected', 'settled')),
  academic_year_id UUID,
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, event_id)
);

-- 4. platform_invoices
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  academic_year_id UUID,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  total_due BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_at TIMESTAMPTZ,
  paid_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, tenant_id, period_label)
`;

export const FUNCTIONS_SQL = `
-- validate_subscription_payment
CREATE OR REPLACE FUNCTION validate_subscription_payment(
  p_request_id UUID, p_validator_id UUID DEFAULT NULL
) RETURNS subscription_payment_requests LANGUAGE plpgsql SECURITY DEFINER AS \$\$
DECLARE v_request subscription_payment_requests;
BEGIN
  SELECT * INTO v_request FROM subscription_payment_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  UPDATE subscription_payment_requests SET status = 'validated', validated_by = p_validator_id, validated_at = NOW() WHERE id = p_request_id RETURNING * INTO v_request;
  RETURN v_request;
END;\$\$;

-- reject_subscription_payment
CREATE OR REPLACE FUNCTION reject_subscription_payment(
  p_request_id UUID, p_validator_id UUID DEFAULT NULL
) RETURNS subscription_payment_requests LANGUAGE plpgsql SECURITY DEFINER AS \$\$
DECLARE v_request subscription_payment_requests;
BEGIN
  SELECT * INTO v_request FROM subscription_payment_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  UPDATE subscription_payment_requests SET status = 'rejected', validated_by = p_validator_id, validated_at = NOW() WHERE id = p_request_id RETURNING * INTO v_request;
  RETURN v_request;
END;\$\$;

-- record_billable_event
CREATE OR REPLACE FUNCTION record_billable_event(
  p_product_id TEXT, p_event_id UUID, p_tenant_id UUID, p_event_type TEXT,
  p_amount BIGINT DEFAULT NULL, p_academic_year_id UUID DEFAULT NULL,
  p_period_label TEXT DEFAULT NULL, p_period_start DATE DEFAULT NULL, p_period_end DATE DEFAULT NULL
) RETURNS platform_fee_ledger LANGUAGE plpgsql SECURITY DEFINER AS \$\$
DECLARE v_config billing_configs; v_amount BIGINT; v_ledger platform_fee_ledger;
BEGIN
  SELECT * INTO v_config FROM billing_configs WHERE product_id = p_product_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONFIG_NOT_FOUND'; END IF;
  v_amount := COALESCE(p_amount, v_config.event_amount);
  INSERT INTO platform_fee_ledger (product_id, event_id, tenant_id, event_type, amount, status, academic_year_id, period_label, period_start, period_end)
  VALUES (p_product_id, p_event_id, p_tenant_id, p_event_type, v_amount, 'due', p_academic_year_id, p_period_label, p_period_start, p_period_end)
  ON CONFLICT (product_id, event_id) DO NOTHING RETURNING * INTO v_ledger;
  IF v_ledger IS NULL THEN SELECT * INTO v_ledger FROM platform_fee_ledger WHERE product_id = p_product_id AND event_id = p_event_id; END IF;
  RETURN v_ledger;
END;\$\$;
`;
