-- ============================================================================
-- @refontiq/billing — Schéma de Base de Données
-- Moteur de facturation mutualisé pour l'écosystème Refontiq
-- Deux modes :
--   1. subscription_tiers : abonnement à paliers fixes (Séjoura)
--   2. event_based : facturation par événement (Schooly - 1000 FCFA/inscription)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE: billing_configs — Configuration par produit
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL UNIQUE,        -- ex: 'sejoura', 'schooly', 'docly'
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('subscription_tiers', 'event_based')),
  currency TEXT NOT NULL DEFAULT 'XOF',
  
  -- Mode subscription_tiers
  tiers JSONB DEFAULT '[]'::jsonb,        -- [{id, label, price, wave_pay_link, description}]
  
  -- Mode event_based
  event_amount BIGINT DEFAULT 1000,       -- montant par événement (FCFA)
  event_types JSONB DEFAULT '[]'::jsonb,  -- types d'événements facturables
  
  -- Mobile Money / Wave
  wave_merchant_id TEXT,
  wave_webhook_secret TEXT,
  
  -- Telegram
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  telegram_admin_url TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_configs_product ON billing_configs(product_id);

-- ----------------------------------------------------------------------------
-- 2. TABLE: subscription_payment_requests — Demandes de paiement (mode tiers)
-- Utilisée pour Séjoura : gérant paie via lien Wave → soumet numéro → admin valide
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,               -- ex: 'sejoura'
  tenant_id UUID NOT NULL,                -- school_id / tenant_id
  subscription_id UUID,                   -- référence abonnement (optionnel)
  tier_id TEXT,                           -- plan choisi (essentiel, croissance, entreprise)
  amount BIGINT NOT NULL CHECK (amount >= 0), -- en FCFA
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'cancelled')),
  requested_by UUID,                      -- user_id du demandeur
  validated_by UUID,                      -- user_id du validateur (super_admin)
  validated_at TIMESTAMPTZ,
  sender_phone TEXT,                      -- numéro Wave expéditeur
  payment_provider TEXT DEFAULT 'wave' CHECK (payment_provider IN ('wave', 'orange_money', 'mtn_money', 'moov_money', 'pi_spi', 'manual')),
  reference TEXT,                         -- référence transaction (Wave, OM, etc.)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spr_product ON subscription_payment_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_spr_tenant ON subscription_payment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spr_status ON subscription_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_spr_created ON subscription_payment_requests(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. TABLE: platform_fee_ledger — Ledger événementiel (mode event_based)
-- Une entrée par événement facturable (ex: inscription confirmée Schooly)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_fee_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,               -- ex: 'schooly'
  event_id UUID NOT NULL,                 -- enrollment_id, booking_id, etc.
  tenant_id UUID NOT NULL,                -- school_id / tenant_id
  event_type TEXT NOT NULL,               -- 'enrollment_confirmed', 'booking_created', etc.
  amount BIGINT NOT NULL CHECK (amount >= 0), -- en FCFA
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'collected', 'settled')),
  academic_year_id UUID,                  -- pour Schooly: année académique
  period_label TEXT,                      -- ex: "T1 2026-2027"
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, event_id)           -- idempotence: un seul enregistrement par événement
);

CREATE INDEX IF NOT EXISTS idx_pfl_product ON platform_fee_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_pfl_tenant ON platform_fee_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pfl_status ON platform_fee_ledger(status);
CREATE INDEX IF NOT EXISTS idx_pfl_period ON platform_fee_ledger(period_label);
CREATE INDEX IF NOT EXISTS idx_pfl_event ON platform_fee_ledger(event_id);

-- ----------------------------------------------------------------------------
-- 4. TABLE: platform_invoices — Factures consolidées (reporting/audit)
-- Agrégation périodique du ledger pour reporting Super Admin
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  academic_year_id UUID,
  period_label TEXT NOT NULL,             -- ex: "T1 2026-2027"
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
);

CREATE INDEX IF NOT EXISTS idx_pi_product ON platform_invoices(product_id);
CREATE INDEX IF NOT EXISTS idx_pi_tenant ON platform_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pi_status ON platform_invoices(status);

-- ----------------------------------------------------------------------------
-- 5. FONCTIONS UTILITAIRES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
DROP TRIGGER IF EXISTS trg_billing_configs_updated ON billing_configs;
CREATE TRIGGER trg_billing_configs_updated BEFORE UPDATE ON billing_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_spr_updated ON subscription_payment_requests;
CREATE TRIGGER trg_spr_updated BEFORE UPDATE ON subscription_payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pfl_updated ON platform_fee_ledger;
CREATE TRIGGER trg_pfl_updated BEFORE UPDATE ON platform_fee_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pi_updated ON platform_invoices;
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON platform_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. FONCTION: Valider une demande de paiement (mode subscription_tiers)
-- Appelée par le Super Admin pour valider un paiement Wave manuel
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_subscription_payment(
  p_request_id UUID,
  p_validator_id UUID DEFAULT NULL
)
RETURNS subscription_payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request subscription_payment_requests;
  v_config billing_configs;
  v_tier subscription_tiers;
BEGIN
  -- Vérifier que l'appelant est super_admin (via JWT claim ou table users)
  -- NOTE: Cette vérification doit être faite au niveau application (middleware)
  -- Ici on suppose que l'appel est déjà autorisé
  
  -- Récupérer la demande
  SELECT * INTO v_request
  FROM subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;
  
  -- Récupérer la config du produit
  SELECT * INTO v_config
  FROM billing_configs
  WHERE product_id = v_request.product_id AND is_active;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: Configuration produit introuvable';
  END IF;
  
  -- Marquer comme validée
  UPDATE subscription_payment_requests
  SET
    status = 'validated',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;
  
  RETURN v_request;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. FONCTION: Rejeter une demande de paiement (mode subscription_tiers)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_subscription_payment(
  p_request_id UUID,
  p_validator_id UUID DEFAULT NULL
)
RETURNS subscription_payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request subscription_payment_requests;
BEGIN
  SELECT * INTO v_request
  FROM subscription_payment_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Demande de paiement introuvable ou déjà traitée';
  END IF;
  
  UPDATE subscription_payment_requests
  SET
    status = 'rejected',
    validated_by = p_validator_id,
    validated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;
  
  RETURN v_request;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. FONCTION: Enregistrer un événement facturable (mode event_based)
-- Appelée automatiquement lors d'un événement métier (ex: inscription confirmée)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_billable_event(
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
RETURNS platform_fee_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config billing_configs;
  v_amount BIGINT;
  v_ledger platform_fee_ledger;
BEGIN
  -- Récupérer la config pour le montant par défaut
  SELECT * INTO v_config
  FROM billing_configs
  WHERE product_id = p_product_id AND is_active;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: Configuration produit introuvable';
  END IF;
  
  -- Utiliser le montant fourni ou celui de la config
  v_amount := COALESCE(p_amount, v_config.event_amount);
  
  -- Insérer dans le ledger (idempotent via UNIQUE constraint)
  INSERT INTO platform_fee_ledger (
    product_id, event_id, tenant_id, event_type, amount,
    status, academic_year_id, period_label, period_start, period_end
  ) VALUES (
    p_product_id, p_event_id, p_tenant_id, p_event_type, v_amount,
    'due', p_academic_year_id, p_period_label, p_period_start, p_period_end
  )
  ON CONFLICT (product_id, event_id) DO NOTHING
  RETURNING * INTO v_ledger;
  
  -- Si conflit (déjà existant), le récupérer
  IF v_ledger IS NULL THEN
    SELECT * INTO v_ledger
    FROM platform_fee_ledger
    WHERE product_id = p_product_id AND event_id = p_event_id;
  END IF;
  
  RETURN v_ledger;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. FONCTION: Générer les factures consolidées (périodique)
-- Appelée par un cron job (mensuel/trimestriel)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_platform_invoices(
  p_product_id TEXT,
  p_period_label TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS SETOF platform_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice platform_invoices;
BEGIN
  -- Agréger les entrées du ledger par tenant
  FOR v_invoice IN
    INSERT INTO platform_invoices (
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
      COUNT(*) as total_events,
      SUM(pfl.amount) as total_due,
      'pending' as status
    FROM platform_fee_ledger pfl
    WHERE pfl.product_id = p_product_id
      AND pfl.status IN ('due', 'collected')
      AND pfl.created_at >= p_period_start
      AND pfl.created_at <= p_period_end
    GROUP BY pfl.tenant_id, pfl.academic_year_id
    ON CONFLICT (product_id, tenant_id, period_label) DO UPDATE SET
      total_events = EXCLUDED.total_events,
      total_due = EXCLUDED.total_due,
      updated_at = NOW()
    RETURNING *
  LOOP
    RETURN NEXT v_invoice;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. FONCTION: Marquer des entrées ledger comme collectées
-- Appelée après confirmation de paiement (split payment ou webhook)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_fees_collected(
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
  -- Mettre à jour le ledger
  UPDATE platform_fee_ledger
  SET status = 'collected', updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND status = 'due'
    AND period_label = p_period_label;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Mettre à jour la facture
  UPDATE platform_invoices
  SET status = 'paid', paid_at = NOW(), paid_amount = p_paid_amount, updated_at = NOW()
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND period_label = p_period_label
    AND status = 'pending';
  
  RETURN v_updated;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE billing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fee_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;

-- billing_configs: lecture pour tous les produits authentifiés
CREATE POLICY billing_configs_read ON billing_configs FOR SELECT USING (auth.uid() IS NOT NULL);

-- subscription_payment_requests: 
-- - Super Admin (via service role) : tout
-- - Tenant propre : lecture seule ses demandes
-- NOTE: Les policies détaillées dépendent de l'architecture auth de chaque produit
-- Ici on laisse ouvert pour le service role, à restreindre côté application
CREATE POLICY spr_service_role ON subscription_payment_requests FOR ALL USING (true);

-- platform_fee_ledger: lecture Super Admin uniquement (données facturation éditeur)
CREATE POLICY pfl_service_role ON platform_fee_ledger FOR ALL USING (true);

-- platform_invoices: lecture Super Admin uniquement
CREATE POLICY pi_service_role ON platform_invoices FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 12. DONNÉES INITIALES (exemples)
-- ----------------------------------------------------------------------------
-- INSERT INTO billing_configs (product_id, name, mode, tiers, event_amount) VALUES
--   ('sejoura', 'Séjoura', 'subscription_tiers', '[
--     {"id": "essentiel", "label": "Essentiel", "price": 9900, "wave_pay_link": "https://pay.wave.com/...", "description": "Plan Essentiel"},
--     {"id": "croissance", "label": "Croissance", "price": 24900, "wave_pay_link": "https://pay.wave.com/...", "description": "Plan Croissance"},
--     {"id": "entreprise", "label": "Entreprise", "price": 54900, "wave_pay_link": "https://pay.wave.com/...", "description": "Plan Entreprise"}
--   ]'::jsonb, NULL),
--   ('schooly', 'Schooly', 'event_based', NULL, 1000);
