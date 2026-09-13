-- ============================================================================
-- 20260912010000 — Grants service_role sur les tables metier
-- Contexte : les tables creees par les migrations locales n'ont aucun GRANT
-- explicite. Sur le projet remote, le role service_role (PostgREST) n'a donc
-- pas le droit SELECT/INSERT sur ces tables -> les scripts serveur
-- (billing:sync, billing:metrics) et les Server Actions recoivent 403, y
-- compris pour de simples comptages. billing_configs passait car elle a eu
-- son GRANT dedie (20260911010000).
-- Idempotent : GRANT IF-like (GRANT est re-executable sans erreur).
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Defaut pour les futurs objets crees par d'autres roles (ceintures + bretelles)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
