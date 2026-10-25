-- Banc d'essai des paiements de factures de plateforme (migration 20261023000000).
-- Se rejoue sur un PostgreSQL JETABLE (jamais sur la production) :
--   createdb bench && psql -d bench -f packages/db/supabase/tests/billing_invoice_payments.sql
-- Les lignes « OK » / « ÉCHEC » s'affichent en messages NOTICE.
-- Ordre : structure minimale + rôles, fonctions de production D'AUJOURD'HUI (migration 20260912),
-- correction déjà appliquée (20261022), nouvelle migration (20261023), puis les scénarios.
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.platform_fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL, tenant_id uuid NOT NULL, amount integer NOT NULL,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','collected','settled')),
  academic_year_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  product_id text NOT NULL DEFAULT 'schooly', event_type text DEFAULT 'enrollment_confirmed',
  period_label text, period_start date, period_end date,
  CONSTRAINT platform_fee_ledger_product_event_unique UNIQUE (product_id, event_id));
CREATE TABLE public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, academic_year_id uuid, period_label text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  total_students integer NOT NULL DEFAULT 0, total_due bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  product_id text NOT NULL DEFAULT 'schooly', total_events integer NOT NULL DEFAULT 0, paid_at timestamptz, paid_amount bigint,
  CONSTRAINT platform_invoices_product_tenant_period_unique UNIQUE (product_id, tenant_id, period_label));
CREATE FUNCTION public.billing_rpc_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
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
-- ============================================================================
-- Correction de la génération des factures de plateforme (3 défauts).
--
-- ÉTAT : APPLIQUÉE en production le 23/10/2026 (autorisation du propriétaire), sous le nom
-- « fix_platform_invoice_generation ». Avant : 0 facture, 2 frais « due » sans période ;
-- après : mêmes données (aucune ligne modifiée). Essai annulé sur les données réelles :
-- 1 facture de 2 événements / 2 000 F, génération idempotente, encaissement = 2 lignes.
-- Le fichier peut être rejoué sans risque (CREATE OR REPLACE).
--
-- Défauts corrigés (reproduits sur un PostgreSQL local avec les fonctions d'origine) :
--
-- 1. generate_platform_invoices PLANTAIT à chaque appel : « query has no destination for
--    result data » (RETURNS SETOF + INSERT … RETURNING sans RETURN QUERY). Aucune facture
--    n'a donc jamais pu être générée.
--
-- 2. Le dernier jour de chaque période était PERDU : `created_at <= p_period_end` compare
--    une date à un timestamptz, donc à MINUIT. Les frais générés le dernier jour n'étaient
--    ni dans la facture de la période, ni dans la suivante. Un établissement dont
--    l'unique inscription date du dernier jour n'avait même aucune facture.
--
-- 3. mark_fees_collected ne met à jour que les lignes dont period_label correspond, or
--    le libellé n'était JAMAIS renseigné (NULL). À l'encaissement, la facture passait à
--    « payée » mais les frais restaient « due » pour toujours.
--
-- Comportement après correction :
--   * les frais « due » non encore facturés (period_label IS NULL) créés AVANT la fin de
--     la période inclus sont rattachés à la facture : rien n'est jamais oublié, y compris
--     un frais en retard ou créé après le paiement d'une facture précédente ;
--   * une facture déjà PAYÉE n'est jamais modifiée ;
--   * regénérer une période est idempotent ;
--   * une facture par établissement et par période, même si les frais couvrent deux
--     années scolaires (l'année la plus récente est retenue) : l'ancien regroupement par
--     (établissement, année) provoquait une erreur « cannot affect row a second time ».
--
-- Non modifié (à décider) : mark_fees_collected n'exige pas que p_paid_amount couvre
-- total_due ; un paiement partiel marque donc toute la facture et tous ses frais comme payés.
--
-- Vérifications avant application (lecture seule) :
--   SELECT count(*) FROM platform_invoices;                       -- attendu : 0
--   SELECT count(*), count(period_label) FROM platform_fee_ledger; -- period_label vide
-- Aucune donnée existante n'est modifiée par cette migration (fonctions uniquement).
-- ============================================================================

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

  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'INVALID_PERIOD: la fin de période (%) précède son début (%)', p_period_end, p_period_start;
  END IF;

  -- 1) Rattacher à cette période tous les frais dus non encore facturés, créés avant la
  --    FIN DE JOURNÉE de p_period_end (jour inclus), sauf pour un établissement dont la
  --    facture de cette période n'est plus « pending » (déjà payée : on ne la modifie pas).
  UPDATE public.platform_fee_ledger l
  SET period_label = p_period_label,
      period_start = p_period_start,
      period_end   = p_period_end,
      updated_at   = NOW()
  WHERE l.product_id = p_product_id
    AND l.status = 'due'
    AND l.period_label IS NULL
    AND l.created_at < (p_period_end + 1)
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_invoices i
      WHERE i.product_id = l.product_id
        AND i.tenant_id = l.tenant_id
        AND i.period_label = p_period_label
        AND i.status <> 'pending'
    );

  -- 2) La facture reflète exactement les frais rattachés à ce libellé.
  RETURN QUERY
  INSERT INTO public.platform_invoices (
    product_id, tenant_id, academic_year_id,
    period_label, period_start, period_end,
    total_events, total_due, status
  )
  SELECT
    p_product_id,
    l.tenant_id,
    (ARRAY_AGG(l.academic_year_id ORDER BY l.created_at DESC))[1],
    p_period_label,
    p_period_start,
    p_period_end,
    COUNT(*)::INTEGER,
    SUM(l.amount),
    'pending'::TEXT
  FROM public.platform_fee_ledger l
  WHERE l.product_id = p_product_id
    AND l.period_label = p_period_label
    AND l.status IN ('due', 'collected')
  GROUP BY l.tenant_id
  ON CONFLICT (product_id, tenant_id, period_label) DO UPDATE SET
    total_events = EXCLUDED.total_events,
    total_due    = EXCLUDED.total_due,
    updated_at   = NOW()
  WHERE public.platform_invoices.status = 'pending'
  RETURNING *;
END;
$$;
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
CREATE OR REPLACE FUNCTION chk(label text, ok boolean, detail text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %  %', CASE WHEN ok THEN 'OK   ' ELSE 'ÉCHEC' END, label, detail; END $$;

-- crée n frais de 1000 F pour un établissement puis génère la facture de la période
CREATE OR REPLACE FUNCTION mk(p_tenant uuid, p_period text, p_start date, p_end date, p_n int, p_created timestamptz) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE i int; v uuid;
BEGIN
  FOR i IN 1..p_n LOOP
    INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at,academic_year_id) VALUES (gen_random_uuid(),p_tenant,1000,p_created + (i||' minutes')::interval,'11111111-0000-0000-0000-000000000001');
  END LOOP;
  PERFORM count(*) FROM generate_platform_invoices('schooly',p_period,p_start,p_end);
  SELECT id INTO v FROM platform_invoices WHERE tenant_id=p_tenant AND period_label=p_period;
  RETURN v;
END $$;
CREATE OR REPLACE FUNCTION expect_error(label text, sql text, pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE sql; PERFORM chk(label, false, 'aucune erreur levée');
EXCEPTION WHEN OTHERS THEN PERFORM chk(label, SQLERRM LIKE pattern, SQLERRM); END $$;
CREATE OR REPLACE FUNCTION fees_collected(p_inv uuid) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM platform_fee_ledger l JOIN platform_invoices i ON i.id=p_inv AND l.tenant_id=i.tenant_id AND l.period_label=i.period_label AND l.product_id=i.product_id WHERE l.status='collected' $$;

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
TRUNCATE platform_invoices, platform_fee_ledger CASCADE;

-- P1 paiement complet
SELECT mk(:A,'2099-01','2099-01-01','2099-01-31',3,'2099-01-10 10:00+00') AS inv \gset p1_
SELECT * FROM record_invoice_payment(:'p1_inv', 3000, 'wave', 'WAVE-0001') \gset r1_
SELECT chk('P1 paiement complet : facture payée, solde 0, 3 frais encaissés', :'r1_out_status'='paid' AND :r1_out_balance=0 AND :r1_out_fees_collected=3 AND fees_collected(:'p1_inv')=3, :'r1_out_status');

-- P2 paiement partiel puis solde (le défaut d'origine : 500 F sur 3000 F → « payée »)
SELECT mk(:B,'2099-01','2099-01-01','2099-01-31',3,'2099-01-10 10:00+00') AS inv \gset p2_
SELECT * FROM record_invoice_payment(:'p2_inv', 1500, 'orange_money', 'OM-0001') \gset r2_
SELECT chk('P2 1500 F sur 3000 F : « partial », 1 frais encaissé (1000 F à la fois), 500 F d''acompte', :'r2_out_status'='partial' AND :r2_out_paid=1500 AND :r2_out_balance=1500 AND :r2_out_fees_collected=1 AND fees_collected(:'p2_inv')=1, :'r2_out_status'||' / '||:r2_out_fees_collected||' frais');
SELECT chk('P2 les frais encaissés sont les PLUS ANCIENS (affectation FIFO)',
  (SELECT bool_and(status='collected') FROM (SELECT status FROM platform_fee_ledger WHERE tenant_id=:B ORDER BY created_at LIMIT 1) x)
  AND (SELECT bool_and(status='due') FROM (SELECT status FROM platform_fee_ledger WHERE tenant_id=:B ORDER BY created_at OFFSET 1) y));
SELECT * FROM record_invoice_payment(:'p2_inv', 1500, 'orange_money', 'OM-0002') \gset r2b_
SELECT chk('P2 le solde de 1500 F : facture payée, 3 frais encaissés', :'r2b_out_status'='paid' AND :r2b_out_fees_collected=2 AND fees_collected(:'p2_inv')=3);

-- P3 trop-perçu → crédit
SELECT mk('cccccccc-0000-0000-0000-000000000003','2099-01','2099-01-01','2099-01-31',3,'2099-01-10 10:00+00') AS inv \gset p3_
SELECT * FROM record_invoice_payment(:'p3_inv', 3500, 'cash', 'CASH-0001') \gset r3_
SELECT chk('P3 3500 F sur 3000 F : facture payée, 500 F conservés en crédit', :'r3_out_status'='paid' AND :r3_out_credit=500
  AND (SELECT COALESCE(SUM(amount),0) FROM platform_credits WHERE tenant_id='cccccccc-0000-0000-0000-000000000003')=500);
SELECT chk('P3 la facture n''est imputée que de 3000 F (le trop-perçu n''est pas compté comme encaissé)', (SELECT paid_amount FROM platform_invoices WHERE id=:'p3_inv')=3000);

-- P4 le crédit est déduit automatiquement de la prochaine facture
SELECT mk('cccccccc-0000-0000-0000-000000000003','2099-02','2099-02-01','2099-02-28',3,'2099-02-10 10:00+00') AS inv \gset p4_
SELECT chk('P4 prochaine facture : 500 F de crédit déduits automatiquement, statut « partial »',
  (SELECT paid_amount FROM platform_invoices WHERE id=:'p4_inv')=500 AND (SELECT status FROM platform_invoices WHERE id=:'p4_inv')='partial'
  AND (SELECT COALESCE(SUM(amount),0) FROM platform_credits WHERE tenant_id='cccccccc-0000-0000-0000-000000000003')=0
  AND EXISTS (SELECT 1 FROM platform_invoice_payments WHERE invoice_id=:'p4_inv' AND method='credit' AND applied_amount=500));

-- P5 trop-perçu appliqué tout de suite à une autre facture ouverte du même établissement
SELECT mk('dddddddd-0000-0000-0000-000000000004','2099-01','2099-01-01','2099-01-31',2,'2099-01-10 10:00+00') AS i1 \gset p5_
SELECT mk('dddddddd-0000-0000-0000-000000000004','2099-02','2099-02-01','2099-02-28',2,'2099-02-10 10:00+00') AS i2 \gset p5_
SELECT * FROM record_invoice_payment(:'p5_i1', 3000, 'wave', 'WAVE-0005') \gset r5_
SELECT chk('P5 3000 F sur 2000 F : 1000 F de surplus déduits de la facture suivante, aucun crédit qui dort',
  :'r5_out_status'='paid' AND (SELECT paid_amount FROM platform_invoices WHERE id=:'p5_i2')=1000
  AND (SELECT COALESCE(SUM(amount),0) FROM platform_credits WHERE tenant_id='dddddddd-0000-0000-0000-000000000004')=0
  AND fees_collected(:'p5_i2')=1);

-- P6 idempotence et références
SELECT * FROM record_invoice_payment(:'p1_inv', 3000, 'wave', 'WAVE-0001') \gset r6_
SELECT chk('P6 rejouer le même paiement : détecté (doublon), rien n''est compté deux fois',
  :'r6_out_duplicate'='t' AND (SELECT count(*) FROM platform_invoice_payments WHERE reference='WAVE-0001')=1 AND (SELECT paid_amount FROM platform_invoices WHERE id=:'p1_inv')=3000);
SELECT expect_error('P6 même référence avec un AUTRE montant : refusé', format('SELECT * FROM record_invoice_payment(%L, 999, ''wave'', ''WAVE-0001'')', :'p1_inv'), 'DUPLICATE_REFERENCE%');
SELECT expect_error('P6 même référence pour une AUTRE facture : refusé', format('SELECT * FROM record_invoice_payment(%L, 3000, ''wave'', ''WAVE-0001'')', :'p2_inv'), 'DUPLICATE_REFERENCE%');
SELECT chk('P6 même référence mais mode DIFFÉRENT = paiement distinct (référence unique par mode)',
  (SELECT count(*) FROM record_invoice_payment(:'p5_i2', 500, 'cash', 'WAVE-0001'))=1);

-- P7 validations
SELECT mk('eeeeeeee-0000-0000-0000-000000000005','2099-03','2099-03-01','2099-03-31',1,'2099-03-10 10:00+00') AS inv \gset p7_
SELECT expect_error('P7 montant nul refusé',      format('SELECT * FROM record_invoice_payment(%L, 0, ''cash'', ''X1'')', :'p7_inv'), 'INVALID_AMOUNT%');
SELECT expect_error('P7 montant négatif refusé',  format('SELECT * FROM record_invoice_payment(%L, -5, ''cash'', ''X2'')', :'p7_inv'), 'INVALID_AMOUNT%');
SELECT expect_error('P7 référence vide refusée',  format('SELECT * FROM record_invoice_payment(%L, 100, ''cash'', ''   '')', :'p7_inv'), 'INVALID_REFERENCE%');
SELECT expect_error('P7 mode inconnu refusé',     format('SELECT * FROM record_invoice_payment(%L, 100, ''bitcoin'', ''X3'')', :'p7_inv'), 'INVALID_METHOD%');
SELECT expect_error('P7 le mode « credit » est réservé au système', format('SELECT * FROM record_invoice_payment(%L, 100, ''credit'', ''X4'')', :'p7_inv'), 'INVALID_METHOD%');
SELECT expect_error('P7 facture inconnue refusée', 'SELECT * FROM record_invoice_payment(gen_random_uuid(), 100, ''cash'', ''X5'')', 'INVOICE_NOT_FOUND%');
SELECT chk('P7 aucun de ces refus n''a laissé de trace', (SELECT count(*) FROM platform_invoice_payments WHERE reference IN ('X1','X2','X3','X4','X5'))=0);

-- P8 registres non modifiables
SELECT expect_error('P8 paiement non modifiable (UPDATE)',  'UPDATE platform_invoice_payments SET amount = 1', 'APPEND_ONLY%');
SELECT expect_error('P8 paiement non supprimable (DELETE)', 'DELETE FROM platform_invoice_payments', 'APPEND_ONLY%');
SELECT expect_error('P8 crédit non modifiable (UPDATE)',    'UPDATE platform_credits SET amount = 1', 'APPEND_ONLY%');
SELECT expect_error('P8 crédit non supprimable (DELETE)',   'DELETE FROM platform_credits', 'APPEND_ONLY%');

-- P9 retards (période de 2020 : échéance dépassée)
SELECT mk('ffffffff-0000-0000-0000-000000000006','2020-01','2020-01-01','2020-01-31',2,'2020-01-10 10:00+00') AS inv \gset p9_
SELECT chk('P9 facture de 2020 créée en attente avec échéance au 15/02/2020', (SELECT status||' '||due_date FROM platform_invoices WHERE id=:'p9_inv')='pending 2020-02-15');
SELECT refresh_overdue_platform_invoices() AS n \gset o_
SELECT chk('P9 le travail quotidien passe la facture en retard', (SELECT status FROM platform_invoices WHERE id=:'p9_inv')='overdue' AND :o_n >= 1);
SELECT * FROM record_invoice_payment(:'p9_inv', 1000, 'cash', 'CASH-0009') \gset r9_
SELECT chk('P9 paiement partiel d''une facture en retard : reste « overdue » (le retard persiste)', :'r9_out_status'='overdue' AND :r9_out_balance=1000);
SELECT * FROM record_invoice_payment(:'p9_inv', 1000, 'cash', 'CASH-0010') \gset r9b_
SELECT chk('P9 solde réglé : « paid »', :'r9b_out_status'='paid');
SELECT chk('P9 une facture non échue n''est pas passée en retard', (SELECT status FROM platform_invoices WHERE id=:'p7_inv')='pending');

-- P10 ancienne fonction mark_fees_collected (utilisée par l'application actuelle)
SELECT mk('99999999-0000-0000-0000-000000000009','2099-04','2099-04-01','2099-04-30',3,'2099-04-10 10:00+00') AS inv \gset p10_
SELECT mark_fees_collected('schooly','99999999-0000-0000-0000-000000000009','2099-04',1000) AS k \gset k1_
SELECT chk('P10 mark_fees_collected 1000 F sur 3000 F : 1 frais encaissé, facture « partial » (avant : tout « payé »)', :k1_k=1 AND (SELECT status FROM platform_invoices WHERE id=:'p10_inv')='partial');
SELECT mark_fees_collected('schooly','99999999-0000-0000-0000-000000000009','2099-04',1000) AS k \gset k2_
SELECT chk('P10 le même appel rejoué ne compte pas le paiement deux fois', :k2_k=0 AND (SELECT paid_amount FROM platform_invoices WHERE id=:'p10_inv')=1000);
SELECT mark_fees_collected('schooly','99999999-0000-0000-0000-000000000009','2099-04',3000) AS k \gset k3_
SELECT chk('P10 un second paiement de 3000 F : facture soldée, 500 F… surplus de 1000 F en crédit', (SELECT status FROM platform_invoices WHERE id=:'p10_inv')='paid'
  AND (SELECT COALESCE(SUM(amount),0) FROM platform_credits WHERE tenant_id='99999999-0000-0000-0000-000000000009')=1000);
SELECT expect_error('P10 période sans facture : erreur explicite (avant : silence)', 'SELECT mark_fees_collected(''schooly'',''99999999-0000-0000-0000-000000000009'',''1999-01'',100)', 'INVOICE_NOT_FOUND%');

-- P11 isolation entre établissements
SELECT chk('P11 les paiements de A et B n''ont pas touché les frais de l''établissement E',
  (SELECT count(*) FROM platform_fee_ledger WHERE tenant_id='eeeeeeee-0000-0000-0000-000000000005' AND status='collected')=0);

-- P14 une facture partielle n'est jamais réécrite par une regénération
SELECT mk('88888888-0000-0000-0000-000000000008','2099-05','2099-05-01','2099-05-31',2,'2099-05-10 10:00+00') AS inv \gset p14_
SELECT * FROM record_invoice_payment(:'p14_inv', 1000, 'cash', 'CASH-0014') \gset r14_
INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at) VALUES (gen_random_uuid(),'88888888-0000-0000-0000-000000000008',1000,'2099-05-20 10:00+00');
SELECT count(*) FROM generate_platform_invoices('schooly','2099-05','2099-05-01','2099-05-31') \gset g14_
SELECT chk('P14 facture partielle intacte après regénération (2 événements, 2000 F), le frais tardif attend la période suivante',
  (SELECT total_events||'/'||total_due FROM platform_invoices WHERE id=:'p14_inv')='2/2000' AND (SELECT period_label IS NULL FROM platform_fee_ledger WHERE created_at='2099-05-20 10:00+00'));

-- P12 droits d'accès
SELECT chk('P12 anonyme : aucune fonction de paiement', NOT has_function_privilege('anon','public.record_invoice_payment(uuid,bigint,text,text,timestamptz)','EXECUTE') AND NOT has_function_privilege('anon','public.refresh_overdue_platform_invoices()','EXECUTE'));
SELECT chk('P12 connecté : enregistrer un paiement possible (la garde interne filtre)', has_function_privilege('authenticated','public.record_invoice_payment(uuid,bigint,text,text,timestamptz)','EXECUTE'));
SELECT chk('P12 fonctions internes inaccessibles aux connectés', NOT has_function_privilege('authenticated','public.refresh_platform_invoice(uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.apply_platform_credits(text,uuid)','EXECUTE'));
SELECT chk('P12 registres illisibles pour anonymes et connectés', NOT has_table_privilege('anon','public.platform_invoice_payments','SELECT') AND NOT has_table_privilege('authenticated','public.platform_invoice_payments','SELECT') AND NOT has_table_privilege('authenticated','public.platform_credits','SELECT'));

-- P13 garde d'accès
CREATE OR REPLACE FUNCTION public.billing_rpc_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
SELECT expect_error('P13 sans droit : paiement refusé', format('SELECT * FROM record_invoice_payment(%L, 100, ''cash'', ''NOPE'')', :'p7_inv'), 'UNAUTHORIZED%');
SELECT expect_error('P13 sans droit : retards refusés', 'SELECT refresh_overdue_platform_invoices()', 'UNAUTHORIZED%');
SELECT expect_error('P13 sans droit : ancienne fonction refusée', 'SELECT mark_fees_collected(''schooly'',''99999999-0000-0000-0000-000000000009'',''2099-04'',100)', 'UNAUTHORIZED%');
CREATE OR REPLACE FUNCTION public.billing_rpc_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
