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
  "/login",
  "/register-school",
  "/verify",
  "/enroll",
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
export function isEntryPath(pathname: string): boolean {
  return pathname === "/" || matchesPrefix(pathname, ENTRY_PATH_PREFIXES)
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
  super_admin: "/dashboard/super-admin",
  direction: "/dashboard/direction",
  compta: "/dashboard/direction",
  secretariat: "/dashboard/direction",
  caisse: "/dashboard/caisse",
  professeur: "/dashboard/pedagogie",
  surveillance: "/dashboard/pedagogie",
  eleve: "/dashboard/eleve",
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