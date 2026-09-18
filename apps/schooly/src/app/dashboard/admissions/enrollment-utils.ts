export const PAYMENT_METHODS = ["cash", "mobile_money", "check", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Especes",
  mobile_money: "Mobile Money",
  check: "Cheque",
  transfer: "Virement bancaire",
}

const SCHOOL_PAYMENT_TYPE_MAP: Record<string, PaymentMethod> = {
  especes: "cash",
  esperes: "cash",
  cash: "cash",
  mobile_money: "mobile_money",
  virement_bancaire: "transfer",
  transfer: "transfer",
  cheque: "check",
  check: "check",
}

export function mapSchoolPaymentType(type: string | null | undefined): PaymentMethod | null {
  if (!type) return null
  return SCHOOL_PAYMENT_TYPE_MAP[type] ?? null
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

export function parseIdList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

export function generateEnrollmentMatricule(schoolId: string, now = new Date()): string {
  const year = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  return `${schoolId.slice(0, 4).toUpperCase()}-${year}-${seq}`
}

export function pickFeeAmount(
  fees: Array<{
    grade_level_id: string | null
    academic_year_id: string
    financial_profile_id: string | null
    amount: number
  }>,
  gradeLevelId: string,
  academicYearId: string,
  financialProfileId?: string | null
): number {
  const forLevel = fees.filter(
    (fee) => fee.grade_level_id === gradeLevelId && fee.academic_year_id === academicYearId
  )
  if (forLevel.length === 0) return 0
  if (financialProfileId) {
    const specific = forLevel.find((fee) => fee.financial_profile_id === financialProfileId)
    if (specific) return specific.amount
  }
  const standard = forLevel.find((fee) => fee.financial_profile_id == null)
  return (standard ?? forLevel[0]).amount
}

// ─── Aides « formulaire intelligent » (purs, utilisés côté client) ──────────

/**
 * Capitalise la première lettre de chaque mot SANS toucher au reste :
 * « jean-paul » → « Jean-Paul », « marie claire » → « Marie Claire »,
 * « n'guessan » → « N'Guessan » — mais « DIALLO » reste « DIALLO »
 * (on ne détruit jamais une majuscule tapée volontairement).
 * Séparateurs reconnus : espaces, tiret, apostrophe, point.
 */
export function capitalizeWords(value: string): string {
  return value.replace(
    /(^|[^\p{L}])(\p{Ll})/gu,
    (_match, separator: string, letter: string) => separator + letter.toUpperCase()
  )
}

/**
 * Formate un numéro de téléphone à la frappe : chiffres groupés par 2
 * (format ivoirien). « 0700000000 » → « 07 00 00 00 00 » ;
 * « +2250700000000 » → « +225 07 00 00 00 00 » ; « 00 225 … » → « +225 … ».
 *
 * Déterministe : la même saisie produit la même chaîne — indispensable car
 * `guardians.phone` sert de clé d'unicité du tuteur (ensureGuardian).
 * L'erreur de saisie (lettre isolée) est tolérée : les chiffres sont extraits,
 * le reste passe inchangé.
 */
export function formatGuardianPhone(value: string): string {
  const raw = value.trim()
  if (!raw) return ""
  const hasPlus = raw.startsWith("+") || raw.startsWith("00")
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw

  let rest = digits
  // « 00 » tapé pour l'international est normalisé en « + »
  if (!raw.startsWith("+") && digits.startsWith("00")) {
    rest = digits.slice(2)
  } else if (raw.startsWith("+")) {
    rest = digits
  }

  // Indicatif ivoirien reconnu : il est isolé pour garder des groupes de 2 lisibles
  if (rest.startsWith("225") && rest.length >= 3) {
    return "+225 " + (rest.slice(3).match(/\d{1,2}/g) ?? []).join(" ")
  }
  const prefix = hasPlus ? "+ " : ""
  return prefix + (rest.match(/\d{1,2}/g) ?? []).join(" ")
}

/**
 * Âge en années révolues à partir d'une date ISO « yyyy-mm-dd ».
 * null si la date est absente ou invalide.
 */
export function calculateAge(dateOfBirth: string, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}
