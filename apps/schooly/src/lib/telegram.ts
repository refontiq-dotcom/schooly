/**
 * Helper Telegram — Alertes internes Refontiq.
 * Envoie l'alerte au Super Admin sur Telegram et la réplique dans Refontiq Control Center.
 */

const TELEGRAM_API = "https://api.telegram.org"

export type TelegramAlertLevel = "info" | "warning" | "error"

const LEVEL_EMOJI: Record<TelegramAlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "🔴",
}

async function mirrorToControlCenter(message: string, level: TelegramAlertLevel, title = "Alerte Schooly") {
  const base = (process.env.CONTROL_CENTER_URL || "").replace(/\/$/, "")
  const secret = process.env.METRICS_PUSH_SECRET
  if (!base || !secret) return

  try {
    await fetch(`${base}/api/telegram-alerts/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        projet: "schooly",
        level,
        title,
        message,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error("[Control Center] Réplication alerte impossible:", err)
  }
}

/**
 * Envoie une alerte au Super Admin.
 * Une panne Telegram/Control Center ne bloque jamais le flux métier.
 */
export async function sendTelegramAlert(
  message: string,
  level: TelegramAlertLevel = "info"
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  const emoji = LEVEL_EMOJI[level]
  const text = `${emoji} *Schooly*\n\n${message}`

  await Promise.allSettled([
    mirrorToControlCenter(message, level),
    (async () => {
      if (!token || !chatId) {
        console.warn("[Telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant — alerte non envoyée")
        return
      }

      try {
        const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
          }),
          signal: AbortSignal.timeout(10_000),
        })

        if (!res.ok) {
          console.error(`[Telegram] Erreur API ${res.status}: ${await res.text()}`)
        }
      } catch (err) {
        console.error("[Telegram] Erreur réseau:", err)
      }
    })(),
  ])
}

// ─── Helpers métier typés ────────────────────────────────────────────────────

export function alertEnrollmentConfirmed(opts: {
  schoolName: string
  studentName: string
  amount: number
}) {
  return sendTelegramAlert(
    `✅ *Nouvelle inscription confirmée*\nÉcole : ${opts.schoolName}\nÉlève : ${opts.studentName}\nCommission due : ${opts.amount.toLocaleString("fr-FR")} FCFA`,
    "info",
    "Nouvelle inscription confirmée"
  )
}

export function alertCashSessionDifference(opts: {
  schoolName: string
  difference: number
  closedBy: string
}) {
  const level: TelegramAlertLevel = Math.abs(opts.difference) > 5000 ? "error" : "warning"
  return sendTelegramAlert(
    `💰 *Écart de caisse détecté*\nÉcole : ${opts.schoolName}\nÉcart : ${opts.difference.toLocaleString("fr-FR")} FCFA\nClôturé par : ${opts.closedBy}`,
    level,
    "Écart de caisse détecté"
  )
}

export function alertRolloverCompleted(opts: {
  schoolName: string
  oldYear: string
  newYear: string
  promoted: number
  repeated: number
  excluded: number
}) {
  return sendTelegramAlert(
    `🔄 *Bascule d'année terminée*\nÉcole : ${opts.schoolName}\n${opts.oldYear} → ${opts.newYear}\nPromus : ${opts.promoted} · Redoublants : ${opts.repeated} · Exclus : ${opts.excluded}`,
    "info",
    "Bascule d'année terminée"
  )
}

export function alertNewSchoolRegistered(opts: {
  schoolName: string
  city?: string
  adminEmail: string
}) {
  return sendTelegramAlert(
    `🏫 *Nouvelle école inscrite*\nNom : ${opts.schoolName}\n${opts.city ? `Ville : ${opts.city}\n` : ""}Admin : ${opts.adminEmail}`,
    "info",
    "Nouvelle école inscrite"
  )
}
