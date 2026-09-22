// ============================================================================
// lib/outbox-templates.ts — Rendu des messages de relance (pur, testable).
//
// Le worker outbox (route /api/cron/outbox-drain) transforme chaque ligne
// `notification_outbox` en texte FR à partir du `template_key` + `payload`
// écrits par les producteurs existants (generateDueReminders, moratoriums).
//
// Mode local (P2-1, sans provider) : le rendu sert d'APERÇU stocké dans
// `error_message` (préfixe PREVIEW) — aucun envoi réel, aucun statut muté
// vers `sent`. Quand le provider WhatsApp arrivera, ce même rendu
// alimentera le corps du message.
//
// Retourne `null` si le template est inconnu → la ligne passe en `failed`
// (pas de retry : réessayer ne fera jamais apparaître le template).
// ============================================================================

export type OutboxPayload = Record<string, unknown>

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function formatAmount(value: unknown): string {
  const n = num(value)
  if (n === null) return "—"
  return `${n.toLocaleString("fr-FR")} FCFA`
}

function formatDate(iso: unknown): string {
  const s = str(iso)
  if (!s) return "—"
  const [y, m, d] = s.slice(0, 10).split("-")
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function signature(payload: OutboxPayload): string {
  const school = str(payload.school_name)
  return school ? `\n— ${school}` : "\n— La direction"
}

/**
 * Rend le texte FR d'une ligne outbox. `null` = template inconnu.
 */
export function renderOutboxMessage(templateKey: string, payload: OutboxPayload): string | null {
  const student = str(payload.student) || "votre enfant"
  const dueDate = formatDate(payload.due_date)
  const amount = formatAmount(payload.amount)
  const balance = formatAmount(payload.balance)
  const sig = signature(payload)

  switch (templateKey) {
    case "fee_reminder_j5":
      return (
        `Bonjour, rappel aimable : les frais de scolarité de ${student} ` +
        `(${amount}, échéance ${dueDate}) arrivent à échéance dans 5 jours. ` +
        `Merci de régulariser avant la date limite pour éviter tout désagrément.${sig}`
      )
    case "fee_reminder_j0":
      return (
        `Bonjour, les frais de scolarité de ${student} (${amount}) ` +
        `sont dus aujourd'hui (${dueDate}). ` +
        `Merci de passer en caisse ou de régulariser dès que possible.${sig}`
      )
    case "fee_reminder_j1":
      return (
        `Bonjour, sauf erreur de notre part, les frais de scolarité de ${student} ` +
        `(${amount}, dus le ${dueDate}) restent impayés (solde : ${balance}). ` +
        `Merci de régulariser au plus vite.${sig}`
      )
    case "fee_reminder_j7":
      return (
        `Bonjour, les frais de scolarité de ${student} restent impayés ` +
        `depuis plus de 7 jours (solde : ${balance}). ` +
        `Veuillez contacter la direction pour régulariser la situation sans délai.${sig}`
      )
    default:
      // Moratoriums : `reminder_<type>` avec payload minimal
      // ({ enrollment_id, reminder_type }) — texte neutre.
      if (templateKey.startsWith("reminder_")) {
        const kind = str(payload.reminder_type) || templateKey.replace(/^reminder_/, "")
        return (
          `Bonjour, rappel concernant votre échéancier de paiement ` +
          `(${kind || "moratoire"}) pour ${student}. ` +
          `Merci de respecter les échéances convenues avec la direction.${sig}`
        )
      }
      return null
  }
}

/**
 * Normalise un numéro ivoirien vers le format E.164 sans préfixe "+"
 * exigé par l'API WhatsApp Cloud (ex. "07 00 00 00 00" → "2250700000000").
 * Retourne `null` si le numéro est inexploitable.
 */
export function normalizeCiPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  // Déjà international avec indicatif CI
  if (digits.startsWith("225") && digits.length >= 11 && digits.length <= 13) return digits
  // "00225..." → strip "00"
  if (digits.startsWith("00225") && digits.length >= 13) return digits.slice(2)
  // Local 10 chiffres (07/05/01...) → préfixe 225
  if (digits.length === 10) return `225${digits}`
  // Local 8 chiffres (ancien format) → préfixe 225
  if (digits.length === 8) return `225${digits}`
  return null
}

/**
 * Délai avant la prochaine tentative : 5min · 2^attempts
 * (attempts=0 → 5min, 1 → 10min, 2 → 20min). Plafonné à 24h
 * (l'exponent est borné à 9 : 5min·2⁹ ≈ 42h > 24h, le plafond s'applique).
 */
export function retryDelayMs(attempts: number): number {
  const capped = Math.min(Math.max(attempts, 0), 9)
  return Math.min(5 * 60 * 1000 * 2 ** capped, 24 * 60 * 60 * 1000)
}
