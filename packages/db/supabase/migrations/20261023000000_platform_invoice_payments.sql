-- ============================================================================
-- Paiements de factures de plateforme : partiels, rapprochés, sans doublon.
--
-- ÉTAT : PRÉPARÉE, NON APPLIQUÉE. À relire puis appliquer par le propriétaire.
--
-- Règle métier (propriétaire) : 1 000 F par élève et par année scolaire. Une facture
-- mensuelle par établissement, à terme échu, échéance 15 jours après la fin de période.
--
-- Avant : mark_fees_collected(…, p_paid_amount) marquait TOUTE la facture « payée » quel que
-- soit le montant (500 F sur 3 000 F → facture entièrement payée, tous les frais encaissés),
-- n'avait aucune notion d'échéance, de doublon, de mode de paiement ni de trop-perçu.
--
-- Après :
--  * platform_invoice_payments : un paiement = une ligne datée, NON MODIFIABLE, avec mode et
--    RÉFÉRENCE UNIQUE (idempotence : rejouer un paiement ne le compte pas deux fois) ;
--  * statut de la facture calculé : pending → partial → paid, et overdue après l'échéance ;
--  * affectation automatique aux frais, du plus ancien au plus récent (1 000 F à la fois) :
--    1 500 F sur 3 frais de 1 000 F → 1 frais encaissé, 500 F d'acompte ;
--  * trop-perçu conservé en CRÉDIT (platform_credits), déduit automatiquement des autres
--    factures ouvertes puis de la prochaine facture générée ; jamais perdu ni refusé ;
--  * mark_fees_collected conservée (même signature) pour l'application existante, désormais
--    idempotente et sans « tout ou rien ».
--
-- Aucune donnée existante n'est modifiée (0 facture à ce jour). Voir le banc d'essai :
-- packages/db/supabase/tests/billing_invoice_payments.sql
-- ============================================================================

-- 1) Statut « partial » + échéance ------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.platform_invoices'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.platform_invoices DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.platform_invoices
  ADD CONSTRAINT platform_invoices_status_check CHECK (status IN ('pending','partial','paid','overdue'));
ALTER TABLE public.platform_invoices
  ADD COLUMN IF NOT EXISTS due_date DATE GENERATED ALWAYS AS (period_end + 15) STORED;

-- 2) Paiements (append-only) ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_invoice_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES public.platform_invoices(id) ON DELETE RESTRICT,
  amount         BIGINT NOT NULL CHECK (amount > 0),            -- argent réellement reçu
  applied_amount BIGINT NOT NULL CHECK (applied_amount >= 0),   -- part imputée à CETTE facture
  method         TEXT NOT NULL CHECK (method IN ('wave','orange_money','mtn_money','cash','bank_transfer','credit','other')),
  reference      TEXT NOT NULL CHECK (length(btrim(reference)) > 0),
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_invoice_payments_method_reference_unique UNIQUE (method, reference),
  CONSTRAINT platform_invoice_payments_applied_le_amount CHECK (applied_amount <= amount)
);
CREATE INDEX IF NOT EXISTS platform_invoice_payments_invoice_idx ON public.platform_invoice_payments (invoice_id);

CREATE TABLE IF NOT EXISTS public.platform_credits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        TEXT NOT NULL,
  tenant_id         UUID NOT NULL,
  amount            BIGINT NOT NULL CHECK (amount <> 0),   -- + trop-perçu reçu, − crédit consommé
  source_payment_id UUID REFERENCES public.platform_invoice_payments(id) ON DELETE RESTRICT,
  invoice_id        UUID REFERENCES public.platform_invoices(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_credits_tenant_idx ON public.platform_credits (product_id, tenant_id);

CREATE OR REPLACE FUNCTION public.platform_finance_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % est un registre financier, % interdit (contre-passer par une nouvelle ligne)', TG_TABLE_NAME, TG_OP;
END $$;
DROP TRIGGER IF EXISTS platform_invoice_payments_append_only ON public.platform_invoice_payments;
CREATE TRIGGER platform_invoice_payments_append_only BEFORE UPDATE OR DELETE ON public.platform_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_append_only();
DROP TRIGGER IF EXISTS platform_credits_append_only ON public.platform_credits;
CREATE TRIGGER platform_credits_append_only BEFORE UPDATE OR DELETE ON public.platform_credits
  FOR EACH ROW EXECUTE FUNCTION public.platform_finance_append_only();

ALTER TABLE public.platform_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_invoice_payments, public.platform_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.platform_invoice_payments, public.platform_credits TO service_role;

-- 3) Recalcul d'une facture : montant payé, statut, affectation aux frais ----------------
CREATE OR REPLACE FUNCTION public.refresh_platform_invoice(p_invoice_id UUID)
RETURNS public.platform_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.platform_invoices; v_paid BIGINT; v_status TEXT;
BEGIN
  SELECT * INTO v FROM public.platform_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND: %', p_invoice_id; END IF;

  SELECT COALESCE(SUM(applied_amount), 0) INTO v_paid FROM public.platform_invoice_payments WHERE invoice_id = p_invoice_id;
  v_status := CASE
    WHEN v_paid >= v.total_due AND v.total_due > 0 THEN 'paid'
    WHEN v.due_date < CURRENT_DATE THEN 'overdue'
    WHEN v_paid > 0 THEN 'partial'
    ELSE 'pending' END;

  UPDATE public.platform_invoices
  SET paid_amount = v_paid,
      status = v_status,
      paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = p_invoice_id RETURNING * INTO v;

  -- Affectation : frais encaissés du plus ancien au plus récent tant que le cumul est couvert.
  WITH fees AS (
    SELECT id, SUM(amount) OVER (ORDER BY created_at, id) AS cum
    FROM public.platform_fee_ledger
    WHERE product_id = v.product_id AND tenant_id = v.tenant_id AND period_label = v.period_label
      AND status IN ('due', 'collected')
  )
  UPDATE public.platform_fee_ledger l
  SET status = CASE WHEN f.cum <= v_paid THEN 'collected' ELSE 'due' END, updated_at = now()
  FROM fees f
  WHERE l.id = f.id AND l.status IS DISTINCT FROM CASE WHEN f.cum <= v_paid THEN 'collected' ELSE 'due' END;

  RETURN v;
END $$;

-- 4) Crédit : dépense le crédit disponible d'un établissement sur ses factures ouvertes ---
CREATE OR REPLACE FUNCTION public.apply_platform_credits(p_product_id TEXT, p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; v_avail BIGINT; v_take BIGINT; v_total BIGINT := 0; v_pay UUID;
BEGIN
  FOR inv IN
    SELECT id, total_due - COALESCE(paid_amount, 0) AS balance FROM public.platform_invoices
    WHERE product_id = p_product_id AND tenant_id = p_tenant_id AND status <> 'paid' AND total_due - COALESCE(paid_amount, 0) > 0
    ORDER BY period_start, id
  LOOP
    SELECT COALESCE(SUM(amount), 0) INTO v_avail FROM public.platform_credits WHERE product_id = p_product_id AND tenant_id = p_tenant_id;
    EXIT WHEN v_avail <= 0;
    v_take := LEAST(v_avail, inv.balance);
    INSERT INTO public.platform_invoice_payments (invoice_id, amount, applied_amount, method, reference)
      VALUES (inv.id, v_take, v_take, 'credit', 'credit:' || gen_random_uuid()::text) RETURNING id INTO v_pay;
    INSERT INTO public.platform_credits (product_id, tenant_id, amount, source_payment_id, invoice_id)
      VALUES (p_product_id, p_tenant_id, -v_take, v_pay, inv.id);
    PERFORM public.refresh_platform_invoice(inv.id);
    v_total := v_total + v_take;
  END LOOP;
  RETURN v_total;
END $$;

-- 5) Enregistrer un paiement -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID, p_amount BIGINT, p_method TEXT, p_reference TEXT, p_received_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (out_payment_id UUID, out_status TEXT, out_paid BIGINT, out_balance BIGINT, out_credit BIGINT, out_fees_collected INTEGER, out_duplicate BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.platform_invoices; ex public.platform_invoice_payments; v_apply BIGINT; v_surplus BIGINT; v_pay UUID; v_before INTEGER; v_after INTEGER; v_ref TEXT := btrim(p_reference);
BEGIN
  IF NOT public.billing_rpc_allowed() THEN RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT: le montant doit être strictement positif'; END IF;
  IF v_ref IS NULL OR v_ref = '' THEN RAISE EXCEPTION 'INVALID_REFERENCE: la référence du paiement est obligatoire'; END IF;
  IF p_method NOT IN ('wave','orange_money','mtn_money','cash','bank_transfer','other') THEN RAISE EXCEPTION 'INVALID_METHOD: %', p_method; END IF;

  SELECT * INTO inv FROM public.platform_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND: %', p_invoice_id; END IF;

  -- Idempotence : même (mode, référence) déjà enregistrés
  SELECT * INTO ex FROM public.platform_invoice_payments WHERE method = p_method AND reference = v_ref;
  IF FOUND THEN
    IF ex.invoice_id = p_invoice_id AND ex.amount = p_amount THEN
      RETURN QUERY SELECT ex.id, i.status, COALESCE(i.paid_amount, 0), i.total_due - COALESCE(i.paid_amount, 0), 0::BIGINT, 0, TRUE
        FROM public.platform_invoices i WHERE i.id = p_invoice_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'DUPLICATE_REFERENCE: la référence % existe déjà pour un autre paiement', v_ref;
  END IF;

  v_apply   := LEAST(p_amount, GREATEST(inv.total_due - COALESCE(inv.paid_amount, 0), 0));
  v_surplus := p_amount - v_apply;

  SELECT count(*) INTO v_before FROM public.platform_fee_ledger WHERE product_id = inv.product_id AND tenant_id = inv.tenant_id AND period_label = inv.period_label AND status = 'collected';
  INSERT INTO public.platform_invoice_payments (invoice_id, amount, applied_amount, method, reference, received_at)
    VALUES (p_invoice_id, p_amount, v_apply, p_method, v_ref, p_received_at) RETURNING id INTO v_pay;
  IF v_surplus > 0 THEN
    INSERT INTO public.platform_credits (product_id, tenant_id, amount, source_payment_id) VALUES (inv.product_id, inv.tenant_id, v_surplus, v_pay);
  END IF;
  inv := public.refresh_platform_invoice(p_invoice_id);
  IF v_surplus > 0 THEN PERFORM public.apply_platform_credits(inv.product_id, inv.tenant_id); END IF;
  SELECT * INTO inv FROM public.platform_invoices WHERE id = p_invoice_id;
  SELECT count(*) INTO v_after FROM public.platform_fee_ledger WHERE product_id = inv.product_id AND tenant_id = inv.tenant_id AND period_label = inv.period_label AND status = 'collected';

  RETURN QUERY SELECT v_pay, inv.status, COALESCE(inv.paid_amount, 0), inv.total_due - COALESCE(inv.paid_amount, 0), v_surplus, v_after - v_before, FALSE;
END $$;

-- 6) Compatibilité : mark_fees_collected (même signature), désormais fondée sur les paiements -
CREATE OR REPLACE FUNCTION public.mark_fees_collected(p_product_id TEXT, p_tenant_id UUID, p_period_label TEXT, p_paid_amount BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv_id UUID; r record;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin'; END IF;
  SELECT id INTO inv_id FROM public.platform_invoices WHERE product_id = p_product_id AND tenant_id = p_tenant_id AND period_label = p_period_label;
  IF inv_id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND: aucune facture % pour cet établissement', p_period_label; END IF;
  -- Référence déterministe : rejouer le même appel ne compte pas le paiement deux fois.
  SELECT * INTO r FROM public.record_invoice_payment(inv_id, p_paid_amount, 'other', 'legacy:' || inv_id::text || ':' || p_paid_amount::text);
  RETURN r.out_fees_collected;
END $$;

-- 7) Retards : à appeler chaque jour (cron) ----------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_overdue_platform_invoices() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin'; END IF;
  UPDATE public.platform_invoices SET status = 'overdue', updated_at = now()
  WHERE status IN ('pending', 'partial') AND due_date < CURRENT_DATE AND COALESCE(paid_amount, 0) < total_due;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- 8) Génération : à la fin, le crédit disponible est déduit des factures ouvertes ----------
CREATE OR REPLACE FUNCTION public.generate_platform_invoices(p_product_id TEXT, p_period_label TEXT, p_period_start DATE, p_period_end DATE)
RETURNS SETOF public.platform_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  IF NOT public.billing_rpc_allowed() THEN RAISE EXCEPTION 'UNAUTHORIZED: opération réservée au service rôle / Super Admin'; END IF;
  IF p_period_end < p_period_start THEN RAISE EXCEPTION 'INVALID_PERIOD: la fin de période (%) précède son début (%)', p_period_end, p_period_start; END IF;

  UPDATE public.platform_fee_ledger l
  SET period_label = p_period_label, period_start = p_period_start, period_end = p_period_end, updated_at = NOW()
  WHERE l.product_id = p_product_id AND l.status = 'due' AND l.period_label IS NULL
    AND l.created_at < (p_period_end + 1)
    AND NOT EXISTS (SELECT 1 FROM public.platform_invoices i WHERE i.product_id = l.product_id AND i.tenant_id = l.tenant_id
                    AND i.period_label = p_period_label AND i.status <> 'pending');

  RETURN QUERY
  INSERT INTO public.platform_invoices (product_id, tenant_id, academic_year_id, period_label, period_start, period_end, total_events, total_due, status)
  SELECT p_product_id, l.tenant_id, (ARRAY_AGG(l.academic_year_id ORDER BY l.created_at DESC))[1], p_period_label, p_period_start, p_period_end,
         COUNT(*)::INTEGER, SUM(l.amount), 'pending'::TEXT
  FROM public.platform_fee_ledger l
  WHERE l.product_id = p_product_id AND l.period_label = p_period_label AND l.status IN ('due', 'collected')
  GROUP BY l.tenant_id
  ON CONFLICT (product_id, tenant_id, period_label) DO UPDATE SET
    total_events = EXCLUDED.total_events, total_due = EXCLUDED.total_due, updated_at = NOW()
  WHERE public.platform_invoices.status = 'pending'
  RETURNING *;

  -- Crédit (trop-perçus passés) déduit automatiquement des factures qui viennent d'être créées.
  FOR t IN SELECT DISTINCT tenant_id FROM public.platform_credits WHERE product_id = p_product_id GROUP BY tenant_id HAVING SUM(amount) > 0
  LOOP
    PERFORM public.apply_platform_credits(p_product_id, t.tenant_id);
  END LOOP;
END $$;

-- 9) Droits : fonctions publiques = authenticated + service_role (garde interne) ; internes = service_role
REVOKE ALL ON FUNCTION public.record_invoice_payment(UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_overdue_platform_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, BIGINT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_overdue_platform_invoices() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_platform_invoice(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_platform_credits(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_platform_invoice(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_platform_credits(TEXT, UUID) TO service_role;
