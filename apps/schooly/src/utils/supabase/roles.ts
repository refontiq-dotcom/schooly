/**
 * Source unique des listes de rôles (audit P2-2).
 *
 * Avant : chaque module recopiait sa liste en dur (`pedagogie`, `admissions`,
 * `finance`, `moratoriums`, `billing`, `services`, `academic-structure`,
 * `api/v1/admin/trouvetou/*`, rollover) — 12 listes jumelles, divergeant au
 * fil des correctifs (un rôle ajouté ici, oublié là).
 *
 * Règle : TOUTE liste de rôles employée par un garde (`requireSchoolRole`,
 * `.in("role_code", …)`) provient de ce module. Les valeurs sont les listes
 * historiques, inchangées — la centralisation ne change aucun comportement.
 */

/** Rôles du personnel (membres d'une école dans `user_school_roles`). */
export const ALL_STAFF_ROLES = [
  "direction",
  "compta",
  "secretariat",
  "caisse",
  "professeur",
  "surveillance",
  "informatique",
] as const
export type StaffRole = (typeof ALL_STAFF_ROLES)[number]

// ─── Finance / facturation ─────────────────────────────────────────────────
/** Actes financiers décisionnels : barèmes, moratoires, profil financier. */
export const FINANCE_DECISION_ROLES = ["direction", "compta"] as const
/** Alias sémantiques (mêmes rôles, intentions distinctes par module). */
export const PRICING_ROLES = FINANCE_DECISION_ROLES
export const MORATORIUM_ROLES = FINANCE_DECISION_ROLES
export const FINANCIAL_PROFILE_ROLES = FINANCE_DECISION_ROLES
/** Encaissements : la caisse intervient en plus de la décision financière. */
export const CASHIER_ROLES = ["direction", "compta", "caisse"] as const
/** Contexte facturation Schooly (résumé, versements, historique). */
export const FINANCE_CONTEXT_ROLES = [
  "direction",
  "secretariat",
  "compta",
  "caisse",
] as const
/** Relances / rappels de paiement : le secrétariat participe. */
export const REMINDER_ROLES = ["direction", "compta", "secretariat"] as const

// ─── Pédagogie ─────────────────────────────────────────────────────────────
/** Écritures pédagogiques : le professeur est l'acteur principal. */
export const TEACHING_ROLES = ["professeur", "direction"] as const
/** Gestion de l’emploi du temps : configuration technique déléguée à l’informatique, pilotable aussi par la direction. */
export const TIMETABLE_ADMIN_ROLES = ["direction", "informatique"] as const
/** Décisions académiques : passage, redoublement, exclusion → acte de direction. */
export const DECISION_ROLES = ["direction"] as const
/** Lectures du référentiel : la vie scolaire (surveillance) suit les élèves. */
export const REF_ROLES = [...TEACHING_ROLES, "surveillance"] as const

// ─── Admissions ────────────────────────────────────────────────────────────
export const ADMISSIONS_ROLES = ["direction", "secretariat"] as const

// ─── Modules complémentaires & structure académique ───────────────────────
/** Transport, cantine, internat : administration = direction/secretariat. */
export const SERVICE_ADMIN_ROLES = ["direction", "secretariat"] as const
/** Années, niveaux, classes, matières, affectations. */
export const STRUCTURE_ADMIN_ROLES = ["direction", "secretariat", "informatique"] as const
/** Rollover d'année : opération sensible réservée à la direction. */
export const ROLLOVER_ROLES = ["direction"] as const

// ─── Trouvetou (API admin) ─────────────────────────────────────────────────
export const TROUVETOU_ADMIN_ROLES = ["direction"] as const
export const TROUVETOU_FINALIZE_ROLES = ["direction", "secretariat"] as const
