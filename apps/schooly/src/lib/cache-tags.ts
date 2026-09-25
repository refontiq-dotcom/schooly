// apps/schooly/src/lib/cache-tags.ts
//
// Source unique des tags de cache utilisés par les getters `unstable_cache`
// (Data Cache) et invalidés par les Server Actions (`updateTag`). Centraliser
// les chaînes ici évite qu'un libellé de tag diverge entre l'import et la
// révalidation, ce qui laisserait un cache périmé sans purge.

/** Liste des encaissements (getPayments) — purgée à chaque encaissement / annulation. */
export const PAYMENTS_CACHE_TAG = "payments"

/** Liste des pré-inscriptions (getPreEnrollments) — purgée à chaque écriture. */
export const PRE_ENROLLMENTS_CACHE_TAG = "pre-enrollments"

/** Chargement du tableau de bord direction (11 lectures PostgREST groupées). */
export const DIRECTION_DASHBOARD_CACHE_TAG = "direction-dashboard"

/**
 * TTL de sécurité (secondes) sur les caches taggués : couvre les mutations
 * que l'on ne passe pas par `updateTag` (pas de purge explicite = fraîcheur
 * garantie au pire après 60 s).
 */
export const READ_CACHE_TTL_SECONDS = 60
