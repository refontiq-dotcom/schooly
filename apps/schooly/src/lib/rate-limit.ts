/**
 * Limitation de débit (R2) pour les entrées publiques.
 *
 * Surface non authentifiée : `/enroll`, `/verify`, les API publiques. Ces
 * points d'entrée sont attaquables sans contrôle d'accès — d'où une double
 * protection : le middleware plafonne par IP sur toute page publique, et les
 * actions sensibles se plafonnent en plus par identifiant métier (école +
 * téléphone, code de reçu, utilisateur + école). Une seconde couche ciblée
 * arrête l'abus ciblé même quand plusieurs personnes partagent une IP.
 *
 * **Portée du compteur** : l'état vit en mémoire du processus. Sur une
 * plateforme serverless (Vercel), chaque instance a son propre compteur — la
 * limite est donc approximative en cas de trafic réparti, ce qui est acceptable
 * pour un garde-fou anti-abus, pas pour une garantie stricte. Un compteur
 * mutualisé (Redis / Upstash) prendrait le relais sans changer l'appelant : il
 * suffit de remplacer `createRateLimiter` par une implémentation distante.
 *
 * Fenêtre fixe plutôt que jeton glissant : une seule division par requête, pas
 * d'écriture concurrente, et un comportement trivial à expliquer à un parent
 * d'élève. Le prix — deux rafales à cheval sur la frontière de fenêtre — est
 * sans conséquence ici.
 */

/** Nombre maximal de clés suivies : borne la mémoire face aux clés jetables. */
const MAX_TRACKED_KEYS = 5_000

export type RateLimitPolicy = {
  /** Requêtes autorisées par fenêtre. */
  limit: number
  /** Longueur de la fenêtre, en millisecondes. */
  windowMs: number
}

export type RateLimitDecision = {
  ok: boolean
  /** Requêtes restantes dans la fenêtre courante (0 si refusée). */
  remaining: number
  /** Secondes à attendre avant de réessayer (0 si acceptée). */
  retryAfterSeconds: number
}

export type RateLimiter = {
  check: (key: string, policy: RateLimitPolicy) => RateLimitDecision
}

type Window = { count: number; expiresAt: number }

/**
 * Limiteur à fenêtre fixe par clé.
 *
 * `now` est injectable pour que les tests couvrent l'expiration de fenêtre sans
 * `await` ni fake timers.
 */
export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, Window>()

  const evictExpired = (at: number) => {
    for (const [key, window] of windows) {
      if (window.expiresAt <= at) windows.delete(key)
    }
  }

  return {
    check(key, policy) {
      const at = now()
      const current = windows.get(key)

      // Fenêtre échue (ou inconnue) : on repart d'un compteur neuf.
      if (!current || current.expiresAt <= at) {
        if (windows.size >= MAX_TRACKED_KEYS) {
          evictExpired(at)
          // Toujours plein après nettoyage (fenêtres vivantes) : on éjecte la
          // plus ancienne, l'ordre d'insertion de la Map le permet. Une clé
          // rarement éjectée ne fait que rejouer sa fenêtre.
          while (windows.size >= MAX_TRACKED_KEYS) {
            const oldest = windows.keys().next()
            if (oldest.done) break
            windows.delete(oldest.value)
          }
        }
        windows.set(key, { count: 1, expiresAt: at + policy.windowMs })
        return {
          ok: true,
          remaining: Math.max(0, policy.limit - 1),
          retryAfterSeconds: 0,
        }
      }

      if (current.count >= policy.limit) {
        return {
          ok: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - at) / 1000)),
        }
      }

      current.count += 1
      return {
        ok: true,
        remaining: Math.max(0, policy.limit - current.count),
        retryAfterSeconds: 0,
      }
    },
  }
}

/** Instance partagée par le serveur (middleware et Server Actions). */
export const rateLimit = createRateLimiter()

/**
 * Politiques par point d'entrée. Volontairement strictes sur ce qui crée ou
 * envoie, larges sur ce qui se contente de lire.
 */
export const RATE_LIMIT_POLICIES = {
  /** Tunnel public `/enroll` : 5 pré-inscriptions par école et par téléphone. */
  preEnrollment: { limit: 5, windowMs: 60_000 },
  /** `/verify/[code]` : lecture d'un reçu par code. */
  receiptVerification: { limit: 30, windowMs: 60_000 },
  /** Relances : envoi de SMS, une fois par heure et par utilisateur. */
  reminders: { limit: 3, windowMs: 3_600_000 },
  /** Pages publiques, par IP : plafond de navigation, pas de métier. */
  publicPage: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>

/**
 * Adresse de l'appelant, vue par le proxy. `x-forwarded-for` porte la
 * chaîne « client, proxy1, proxy2 » : seul le premier élément désigne le client.
 * Absence d'en-tête (développement local) → `null`, et l'appelant décide
 * alors de ne pas limiter plutôt que de regrouper tout le monde.
 */
export function clientIpFromHeaders(
  get: (name: string) => string | null | undefined
): string | null {
  const forwarded = get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  if (first) return first
  const realIp = get("x-real-ip")?.trim()
  return realIp ? realIp : null
}
