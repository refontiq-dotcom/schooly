-- ============================================================================
-- 20260913000003 — Fix faille critique billing_configs (audit Phase 13)
-- AVANT : policy billing_configs_read = (auth.uid() IS NOT NULL) → n'importe
-- quel utilisateur authentifié (parent, élève, enseignant...) pouvait lire
-- telegram_bot_token, telegram_chat_id, wave_webhook_secret via l'API.
-- APRÈS : seul is_super_admin() peut lire/écrire billing_configs. L'accès
-- applicatif serveur passe par service_role (toujours autorisé).
-- Idempotent : DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

-- 1. Policy SELECT : super admin uniquement
DROP POLICY IF EXISTS billing_configs_read ON public.billing_configs;
CREATE POLICY billing_configs_read ON public.billing_configs
  FOR SELECT USING (public.is_super_admin());

-- 2. Policies INSERT/UPDATE/DELETE : super admin uniquement
--    (défense en profondeur même si les écritures actuelles passent par
--    le script sync-config.mjs en service_role)
DROP POLICY IF EXISTS billing_configs_insert ON public.billing_configs;
CREATE POLICY billing_configs_insert ON public.billing_configs
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS billing_configs_update ON public.billing_configs;
CREATE POLICY billing_configs_update ON public.billing_configs
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS billing_configs_delete ON public.billing_configs;
CREATE POLICY billing_configs_delete ON public.billing_configs
  FOR DELETE USING (public.is_super_admin());
