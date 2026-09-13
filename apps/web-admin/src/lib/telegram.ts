/**
 * Helper Telegram — Alertes internes Refontiq
 *
 * Envoie un message texte au Super Admin via le bot Telegram partagé.
 * Convention standard Refontiq (refontiq-architecture-ecosysteme.md §8) :
 * utiliser ce canal pour tout événement nécessitant l'attention du Super Admin.
 *
 * Variables d'environnement requises :
 *   TELEGRAM_BOT_TOKEN  — token du bot Telegram (jamais exposé côté client)
 *   TELEGRAM_CHAT_ID    — ID du chat/groupe du Super Admin
 *
 * Migration vers @refontiq/billing : remplacer les imports de ce fichier
 * par `import { sendTelegramAlert } from '@refontiq/billing'` — aucun autre
 * changement nécessaire si la signature reste identique.
 */

const TELEGRAM_API = "https://api.telegram.org"

export type TelegramAlertLevel = "info" | "warning" | "error"

const LEVEL_EMOJI: Record<TelegramAlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "🔴",
}

/**
 * Envoie une alerte Telegram au Super Admin.
 * Ne lève jamais d'exception — loggue silencieusement si l'envoi échoue
 * pour ne pas bloquer le flux métier principal.
 */
export async function sendTelegramAlert(
  message: string,
  level: TelegramAlertLevel = "info"
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    // En développement : log sans erreur fatale
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant — alerte non envoyée")
    return
  }

  const emoji = LEVEL_EMOJI[level]
  const text = `${emoji} *Schooly*\n\n${message}`

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[Telegram] Erreur API ${res.status}: ${body}`)
    }
  } catch (err) {
    // Ne jamais bloquer le flux métier
    console.error("[Telegram] Erreur réseau:", err)
  }
}

// ─── Helpers métier typés ────────────────────────────────────────────────────

/** Alerte : une inscription vient d'être confirmée → commission due */
export function alertEnrollmentConfirmed(opts: {
  schoolName: string
  studentName: string
  amount: number
}) {
  return sendTelegramAlert(
    `✅ *Nouvelle inscription confirmée*\n` +
    `École : ${opts.schoolName}\n` +
    `Élève : ${opts.studentName}\n` +
    `Commission due : ${opts.amount.toLocaleString("fr-FR")} FCFA`,
    "info"
  )
}

/** Alerte : clôture de caisse avec écart non nul */
export function alertCashSessionDifference(opts: {
  schoolName: string
  difference: number
  closedBy: string
}) {
  const level: TelegramAlertLevel = Math.abs(opts.difference) > 5000 ? "error" : "warning"
  return sendTelegramAlert(
    `💰 *Écart de caisse détecté*\n` +
    `École : ${opts.schoolName}\n` +
    `Écart : ${opts.difference.toLocaleString("fr-FR")} FCFA\n` +
    `Clôturé par : ${opts.closedBy}`,
    level
  )
}

/** Alerte : bascule d'année académique terminée */
export function alertRolloverCompleted(opts: {
  schoolName: string
  oldYear: string
  newYear: string
  promoted: number
  repeated: number
  excluded: number
}) {
  return sendTelegramAlert(
    `🔄 *Bascule d'année terminée*\n` +
    `École : ${opts.schoolName}\n` +
    `${opts.oldYear} → ${opts.newYear}\n` +
    `Promus : ${opts.promoted} · Redoublants : ${opts.repeated} · Exclus : ${opts.excluded}`,
    "info"
  )
}

/** Alerte : nouvelle école inscrite sur la plateforme */
export function alertNewSchoolRegistered(opts: {
  schoolName: string
  city?: string
  adminEmail: string
}) {
  return sendTelegramAlert(
    `🏫 *Nouvelle école inscrite*\n` +
    `Nom : ${opts.schoolName}\n` +
    (opts.city ? `Ville : ${opts.city}\n` : "") +
    `Admin : ${opts.adminEmail}`,
    "info"
  )
}
