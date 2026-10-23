-- Banc d'essai de la génération des factures de plateforme (migration 20261022000000).
-- Se rejoue sur un PostgreSQL JETABLE (jamais sur la production) :
--   createdb bench
--   psql -d bench -f packages/db/supabase/tests/billing_invoice_generation.sql
-- Les lignes « OK » / « ÉCHEC » s'affichent en messages NOTICE.
-- Il crée la structure minimale des deux tables, installe les fonctions D'ORIGINE
-- (migration 20260912), applique la migration corrective, puis déroule les scénarios.
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
-- ===== fonctions d'origine (20260912) =====
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
-- ===== migration corrective =====
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
-- ===== scénarios =====
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
CREATE OR REPLACE FUNCTION chk(label text, ok boolean, detail text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %  %', CASE WHEN ok THEN 'OK   ' ELSE 'ÉCHEC' END, label, detail; END $$;
CREATE OR REPLACE FUNCTION reset_data() RETURNS void LANGUAGE sql AS $$
 TRUNCATE platform_invoices, platform_fee_ledger;
 INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at,academic_year_id) VALUES
  (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001',1000,'2026-10-15 10:00+00','11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001',1000,'2026-10-20 10:00+00','11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001',1000,'2026-10-31 14:30+00','11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001',1000,'2026-11-01 09:00+00','11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(),'bbbbbbbb-0000-0000-0000-000000000002',1000,'2026-10-31 23:59+00','11111111-0000-0000-0000-000000000001');
 INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at,product_id) VALUES
  (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001',9999,'2026-10-15 10:00+00','autre_produit');
$$;

-- S1 : génération d'octobre
SELECT reset_data();
SELECT count(*) FROM generate_platform_invoices('schooly','2026-10','2026-10-01','2026-10-31') \gset n_
SELECT chk('S1 la fonction ne plante plus : 2 factures (A et B)', :n_count = 2, 'factures='||:n_count);
SELECT total_events AS ev, total_due AS due FROM platform_invoices WHERE tenant_id=:A \gset a_
SELECT chk('S1 A : 3 événements dont celui du DERNIER JOUR', :a_ev = 3 AND :a_due = 3000, :a_ev||' ev / '||:a_due||' F');
SELECT total_due AS due FROM platform_invoices WHERE tenant_id=:B \gset b_
SELECT chk('S1 B : l''inscription du 31/10 23:59 est facturée (avant : AUCUNE facture)', :b_due = 1000);
SELECT chk('S1 le frais du 01/11 n''est PAS dans la facture d''octobre',
  (SELECT period_label IS NULL AND status='due' FROM platform_fee_ledger WHERE created_at='2026-11-01 09:00+00'));
SELECT chk('S1 les frais d''un AUTRE produit ne sont ni facturés ni marqués',
  (SELECT period_label IS NULL FROM platform_fee_ledger WHERE product_id='autre_produit'));
SELECT chk('S1 les lignes facturées portent le libellé de période',
  (SELECT count(*) FROM platform_fee_ledger WHERE period_label='2026-10' AND product_id='schooly') = 4);

-- S2 : idempotence
SELECT count(*) FROM generate_platform_invoices('schooly','2026-10','2026-10-01','2026-10-31') \gset r_
SELECT chk('S2 regénérer la même période : toujours 2 factures, montants inchangés',
  (SELECT count(*) FROM platform_invoices)=2 AND (SELECT total_due FROM platform_invoices WHERE tenant_id=:A)=3000);

-- S3 : encaissement (le défaut n°3)
SELECT mark_fees_collected('schooly',:A,'2026-10',3000) AS maj \gset m_
SELECT chk('S3 mark_fees_collected met à jour les 3 lignes (avant : 0)', :m_maj = 3, 'lignes='||:m_maj);
SELECT chk('S3 facture A payée, B toujours en attente (isolation entre établissements)',
  (SELECT status FROM platform_invoices WHERE tenant_id=:A)='paid' AND (SELECT status FROM platform_invoices WHERE tenant_id=:B)='pending');
SELECT chk('S3 les frais de A sont « collected », ceux de B restent « due »',
  (SELECT count(*) FROM platform_fee_ledger WHERE tenant_id=:A AND product_id='schooly' AND status='collected')=3
  AND (SELECT status FROM platform_fee_ledger WHERE tenant_id=:B)='due');

-- S4 : une facture PAYÉE n'est jamais modifiée, même si un frais tardif arrive
INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at,academic_year_id)
  VALUES (gen_random_uuid(),:A,1000,'2026-10-25 08:00+00','11111111-0000-0000-0000-000000000001');
SELECT count(*) FROM generate_platform_invoices('schooly','2026-10','2026-10-01','2026-10-31') \gset r2_
SELECT chk('S4 facture payée intacte (3000 F, 3 événements, payée) après regénération',
  (SELECT total_due||'/'||total_events||'/'||status FROM platform_invoices WHERE tenant_id=:A)='3000/3/paid');
SELECT chk('S4 le frais tardif de A reste « due » et non rattaché (attend la prochaine période)',
  (SELECT period_label IS NULL AND status='due' FROM platform_fee_ledger WHERE created_at='2026-10-25 08:00+00'));

-- S5 : rattrapage — la facture de novembre reprend le frais tardif ET celui du 01/11
SELECT count(*) FROM generate_platform_invoices('schooly','2026-11','2026-11-01','2026-11-30') \gset r3_
SELECT total_events AS ev, total_due AS due FROM platform_invoices WHERE tenant_id=:A AND period_label='2026-11' \gset n_
SELECT chk('S5 novembre reprend le frais tardif d''octobre + celui du 01/11 (rien n''est oublié)', :n_ev = 2 AND :n_due = 2000, :n_ev||' ev / '||:n_due||' F');
SELECT chk('S5 aucun frais « due » sans libellé ne subsiste pour A',
  (SELECT count(*) FROM platform_fee_ledger WHERE tenant_id=:A AND product_id='schooly' AND status='due' AND period_label IS NULL)=0);

-- S6 : deux années scolaires dans une même période (l'ancien code : erreur « second time »)
SELECT reset_data();
INSERT INTO platform_fee_ledger (event_id,tenant_id,amount,created_at,academic_year_id)
  VALUES (gen_random_uuid(),:A,1000,'2026-09-02 08:00+00','22222222-0000-0000-0000-000000000009');
SELECT count(*) FROM generate_platform_invoices('schooly','2026-10','2026-10-01','2026-10-31') \gset y_
SELECT chk('S6 deux années scolaires : une seule facture par établissement, sans erreur',
  (SELECT count(*) FROM platform_invoices WHERE tenant_id=:A)=1 AND (SELECT total_events FROM platform_invoices WHERE tenant_id=:A)=4);
SELECT chk('S6 l''année la plus récente est retenue',
  (SELECT academic_year_id FROM platform_invoices WHERE tenant_id=:A)='11111111-0000-0000-0000-000000000001');

-- S7 : période invalide et garde d'accès
DO $$ BEGIN PERFORM generate_platform_invoices('schooly','x','2026-10-31','2026-10-01');
  PERFORM chk('S7 période inversée refusée', false);
EXCEPTION WHEN OTHERS THEN PERFORM chk('S7 période inversée refusée', SQLERRM LIKE 'INVALID_PERIOD%', SQLERRM); END $$;
CREATE OR REPLACE FUNCTION public.billing_rpc_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
DO $$ BEGIN PERFORM generate_platform_invoices('schooly','2026-10','2026-10-01','2026-10-31');
  PERFORM chk('S7 garde d''accès : refusé sans droit', false);
EXCEPTION WHEN OTHERS THEN PERFORM chk('S7 garde d''accès : refusé sans droit', SQLERRM LIKE 'UNAUTHORIZED%', SQLERRM); END $$;
