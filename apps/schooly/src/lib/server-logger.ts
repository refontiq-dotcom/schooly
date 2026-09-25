// apps/schooly/src/lib/server-logger.ts
//
// Journalisation structurée côté serveur (R1) : une ligne JSON par événement,
// exposée en stdout — c'est le format attendu par les collecteurs (Vercel,
// Cloud Logging, Loki…). Zéro dépendance aujourd'hui ; l'adoption de pino
// (voir plan XXL R1) pourra remplacer l'implémentation sans changer les
// callleurs : `logServerEvent(level, event, context)`.

type LogLevel = "info" | "warn" | "error"

export type LogContext = Record<string, unknown>

/**
 * Émet un événement de journalisation structuré.
 * - `error` : défaillance système ou métier nécessitant une attention.
 * - `warn`  : refus métier / écart contrôlé (ex. encaissement refusé, écart de caisse).
 * - `info`  : trace d'écritures sensibles (argent, inscriptions).
 *
 * Ne JAMAIS y faire passer des données personnelles brutes beyond le besoin
 * d'audit (les identifiants suffisent : schoolId, enrollmentId, matricule…).
 */
export function logServerEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {}
): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  })
  if (level === "error") console.error(entry)
  else if (level === "warn") console.warn(entry)
  else console.info(entry)
}
