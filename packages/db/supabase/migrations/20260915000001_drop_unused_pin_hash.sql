-- ============================================================================
-- 20260915000001 — Suppression de la colonne non utilisée public.users.pin_hash
-- ----------------------------------------------------------------------------
-- Contexte (audit socle, finding P1-4) :
--   * la colonne a été créée par 20260908090000 (tenancy_auth) mais AUCUN code
--     applicatif ne la lit et ne l'écrit (vérifié par recherche dans le dépôt) ;
--   * en production, AUCUNE ligne ne la renseigne (0 valeur non nulle) ;
--   * elle a été exposée par la route /api/debug (corrigée par suppression de
--     la route) : garder une colonne « future auth » non utilisée incite à y
--     écrire un PIN en clair un jour.
--
-- Décision : suppression. Si un login par PIN est (ré)introduit, il devra être
-- réimplémenté avec un hachage bcrypt via pgcrypto : crypt(pin, gen_salt('bf')),
-- un PIN d'au moins 6 chiffres et une limitation du nombre de tentatives.
--
-- Idempotent : ré-exécutable sans erreur.
-- ============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS pin_hash;