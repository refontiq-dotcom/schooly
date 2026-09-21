/**
 * Règles de routage du socle d'authentification (partagées proxy ⇄ login).
 *
 * Pourquoi un module pur dédié : une régression sur ces règles est *silencieuse*.
 * Un tunnel public bloqué ne renvoie pas d'erreur, il renvoie une redirection
 * 307 vers /login (constaté : /register-school, /enroll/*, /verify/*) ; un rôle
 * absent de la table de routage, lui, renvoie tout le monde sur /login.
 * Isolé ici pour être testé unitairement.
 *
 * Cf. docs/security/audit-socle-auth-tenancy.md (findings C2 et M4).
 */

/**
 * Préfixes accessibles SANS session.
 * Tunnels publics : inscription d'école, pré-inscription élève, vérification
 * de dossier, ainsi que les écrans de connexion (/ et /login).
 */
export const PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/register-school",
  "/verify",
  "/enroll",
  "/auth/callback",
  "/legal",
] as const

/**
 * Préfixes techniques : jamais soumis au contrôle de session ici.
 * `/api/*` porte ses propres gardes (Bearer token ou session Supabase) et
 * `/api/health` doit rester joignable par les sondes de disponibilité.
 */
export const TECHNICAL_PATH_PREFIXES = ["/api", "/_next"] as const

/**
 * Écrans d'entrée : seules pages sur lesquelles un utilisateur DÉJÀ connecté est
 * redirigé vers son tableau de bord. `/` est l'écran de connexion unifié.
 */
export const ENTRY_PATH_PREFIXES = ["/login"] as const

/** Vrai si `pathname` vaut un préfixe ou se trouve dans son arborescence. */
export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/** Vrai si le chemin est joignable sans session (public ou technique). */
export function isPublicPath(pathname: string): boolean {
  return (
    matchesPrefix(pathname, PUBLIC_PATH_PREFIXES) ||
    matchesPrefix(pathname, TECHNICAL_PATH_PREFIXES)
  )
}

/** Vrai si le chemin est un écran d'entrée (/, /login…). */
/** Routes conservées accessibles lorsque la facturation est restreinte/suspendue. */
export const BILLING_ACCESS_PATH_PREFIXES = [
  "/dashboard/billing",
  "/api/billing",
  "/api/school/export",
  "/legal",
] as const

export function isBillingAccessPath(pathname: string): boolean {
  return matchesPrefix(pathname, BILLING_ACCESS_PATH_PREFIXES)
}

export function isEntryPath(pathname: string): boolean {
  return pathname === "/" || matchesPrefix(pathname, ENTRY_PATH_PREFIXES)
}

/**
 * Portail élève (audit P1-1) : surface autonome authentifiée par le cookie QR
 * `schooly_student_enrollment`, revérifié à chaque lecture. Les élèves n'ont pas
 * de compte Supabase Auth : ce chemin doit donc court-circuiter la garde de
 * session staff. Placé hors de `/dashboard` car le layout de celui-ci exige une
 * session — ce qui rendait le portail inutilisable (bug de production).
 */
export const STUDENT_PORTAL_PREFIXES = ["/eleve"] as const

/** Vrai si le chemin appartient au portail élève. */
export function isStudentPortalPath(pathname: string): boolean {
  return matchesPrefix(pathname, STUDENT_PORTAL_PREFIXES)
}

/**
 * Redirections d'URLs legacy (audit P1-1) : l'ancienne URL du portail, encore
 * présente dans les QR codes imprimés et les favoris, renvoie vers la nouvelle
 * surface — sous-chemin éventuel conservé.
 */
export function legacyRedirectFor(pathname: string): string | null {
  if (pathname === "/dashboard/eleve") return "/eleve"
  if (pathname.startsWith("/dashboard/eleve/")) {
    return "/eleve" + pathname.slice("/dashboard/eleve".length)
  }
  return null
}

/**
 * Destination par défaut d'un rôle après connexion.
 * Source unique de vérité, partagée par le proxy (routage session) et par les
 * Server Actions de connexion — évite les divergences constatées (findings M4 :
 * `compta`, `secretariat` et `surveillance` étaient absents du proxy).
 *
 * `parent` est volontairement absent : ce rôle est servi par l'application PWA
 * parente (`apps/pwa-parent`), il n'a pas de tableau de bord dans cette app.
 */
export const ROLE_HOME: Readonly<Record<string, string>> = {
  direction: "/dashboard/direction",
  compta: "/dashboard/direction/finance",
  secretariat: "/dashboard/direction/admissions",
  informatique: "/dashboard/informatique",
  caisse: "/dashboard/caisse",
  professeur: "/dashboard/pedagogie",
  surveillance: "/dashboard/pedagogie",
  // Portail élève : surface autonome /eleve (auth par code QR, cf. P1-1) —
  // volontairement PAS sous /dashboard dont le layout exige une session staff.
  eleve: "/eleve",
}

/**
 * Tableau de bord d'un rôle, ou `null` si le rôle n'en a pas dans cette app.
 * `null` ne doit PAS être transformé en redirection vers /login : cela boucle
 * la connexion d'un rôle pourtant valide.
 */
export function roleHome(roleCode: string | null | undefined): string | null {
  if (!roleCode) return null
  return ROLE_HOME[roleCode] ?? null
}

export const ROLE_ALLOWED_PATHS: Readonly<Record<string, readonly string[]>> = {
  direction: ["/dashboard/direction", "/dashboard/academic-structure", "/dashboard/services", "/dashboard/billing", "/dashboard/admin", "/dashboard/pedagogie", "/dashboard/caisse"],
  secretariat: ["/dashboard/direction/admissions", "/dashboard/academic-structure", "/dashboard/services"],
  informatique: ["/dashboard/informatique", "/dashboard/academic-structure", "/dashboard/direction/settings", "/dashboard/direction/reports", "/dashboard/informatique/emploi-du-temps"],
  compta: ["/dashboard/direction/finance", "/dashboard/direction/reports", "/dashboard/billing"],
  caisse: ["/dashboard/caisse"],
  professeur: ["/dashboard/pedagogie"],
  surveillance: ["/dashboard/pedagogie/vie-scolaire"],
}

export const ROLE_DENIED_PATHS: Readonly<Record<string, readonly string[]>> = {
  professeur: ["/dashboard/pedagogie/vie-scolaire"],
}

export function isRoleAllowedPath(roleCode: string | null | undefined, pathname: string): boolean {
  if (!roleCode) return false
  const denied = ROLE_DENIED_PATHS[roleCode] ?? []
  if (denied.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) return false
  const prefixes = ROLE_ALLOWED_PATHS[roleCode]
  if (!prefixes) return false
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
}