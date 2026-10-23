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
