/**
 * Socle d'autorisation des Server Actions (cf. audit P1-2, P2-2).
 *
 * Problème résolu : chaque fichier d'actions dupliquait sa variante de
 * `getSchoolId()` (4 variantes recensées) et **aucune** ne vérifiait le
 * `role_code`. Bilan mesuré : 3 actions sur ~100 vérifiaient un rôle —
 * un professeur pouvait créer un barème de frais, un surveillant valider une
 * pré-inscription. Le cloisonnement inter-écoles tenait (le `school_id` est
 * résolu depuis la session) ; c'est le cloisonnement inter-rôles qui manquait.
 *
 * Ce module fournit UNE fonction à appeler au début de chaque Server Action :
 * elle renvoie `{ schoolId, roleCode, userId }` ou `null` (+ l'objet `guard` à
 * retourner tel quel au client pour respecter le contrat d'erreur existant).
 *
 * Règles métier :
 * - `allowedRoles` vide = toute école membre active (lecture générique ;
 *   la vérification `schoolId` reste obligatoire, voir `scoped`).
 * - `scoped: true` (défaut) = un éventuel `schoolId` fourni par le client
 *   (paramètre de lecture comme `getPayments(schoolId)`) est IGNORÉ s'il ne
 *   correspond pas à l'école de la session → ferme les IDOR cross-tenant
 *   constatés sur les lectures finance (getPayments, getFeeSchedules,
 *   getCashSessions… prenaient le school_id en paramètre, sans vérification).
 * - Le client Supabase passé en paramètre est le client **session** (RLS).
 *   La requête lit `user_school_roles` via la policy `usr_read` — pas besoin
 *   de service_role pour lire son propre rattachement.
 */

export type FinanceRole =
  | "direction"
  | "compta"
  | "caisse"
  | "secretariat"
  | "super_admin"

export type AuthContext = {
  userId: string
  schoolId: string
  roleCode: string
}

export type DeniedReason =
  | "UNAUTHENTICATED" // pas de session
  | "NO_SCHOOL" // authentifié mais sans rattachement actif
  | "FORBIDDEN_ROLE" // rôle hors de la liste autorisée
  | "CROSS_TENANT" // school_id demandé ≠ école de la session

export type GuardOutcome =
  | { ok: true; context: AuthContext }
  | { ok: false; reason: DeniedReason }

export const ERROR_BY_REASON: Record<DeniedReason, string> = {
  UNAUTHENTICATED: "Non autorisé",
  NO_SCHOOL: "Aucune école rattachée",
  FORBIDDEN_ROLE: "Action réservée à un rôle supérieur.",
  CROSS_TENANT: "Accès non autorisé.",
}

export type RequireRoleOptions = {
  /** Rôles autorisés. Vide (défaut) = tout membre actif de l'école. */
  allowedRoles?: readonly string[]
  /**
   * school_id fourni par le client (paramètre de lecture). S'il est présent
   * et différent de l'école de la session → refus CROSS_TENANT.
   * `undefined` = pas de garde supplémentaire (écritures).
   */
  requestedSchoolId?: string | null
}

/**
 * Contrat minimal du client « session » consommé par la garde.
 *
 * Volontairement lâche sur `from` : le client réel (supabase-js) porte des
 * génériques de schéma si profonds que tout typage structurel de la chaîne
 * `.from().select().eq()` fait exploser TypeScript (TS2589 « instantiation
 * excessively deep ») dès le premier site d'appel — constaté sur les 18
 * actions du module Finance. On n'exige donc que la forme consommée
 * (auth.getUser + from) et le résultat de la requête est re-typé dans la
 * garde via `RoleQueryResult` : la sûreté de type est concentrée ici plutôt
 * que dupliquée dans chaque Server Action.
 */
export type RoleQueryResult = {
  data: { school_id: string; role_code: string } | null
}

export type SupabaseUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS2589, cf. justification du bloc ci-dessus
  from: (table: string) => any
}

/**
 * Garde d'autorisation : session + rattachement actif + rôle + cloisonnement.
 * Pure vis-à-vis des effets (ne redirige jamais, ne lève jamais) : facile à
 * tester, et le caller retourne simplement l'erreur métier prévue.
 */
export async function requireSchoolRole(
  supabase: SupabaseUserClient,
  options: RequireRoleOptions = {}
): Promise<GuardOutcome> {
  const { allowedRoles = [], requestedSchoolId } = options

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" }

  const { data: role } = (await supabase
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()) as RoleQueryResult & { error?: unknown }

  if (!role?.school_id) return { ok: false, reason: "NO_SCHOOL" }

  if (
    requestedSchoolId != null &&
    requestedSchoolId !== "" &&
    requestedSchoolId !== role.school_id
  ) {
    return { ok: false, reason: "CROSS_TENANT" }
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role.role_code)) {
    return { ok: false, reason: "FORBIDDEN_ROLE" }
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      schoolId: role.school_id,
      roleCode: role.role_code,
    },
  }
}

/**
 * Construit la réponse d'erreur standard d'une garde refusée, dans la forme
 * `{ error, data }` utilisée par toutes les actions de lecture du module.
 */
export function denial<TData>(
  reason: DeniedReason,
  data: TData
): { error: string; data: TData } {
  return { error: ERROR_BY_REASON[reason], data }
}
