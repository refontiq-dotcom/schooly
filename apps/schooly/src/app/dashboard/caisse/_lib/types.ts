/**
 * Modèle typé du module caisse + normalisation à la frontière des données.
 *
 * Les server actions renvoient `unknown` : toute donnée qui entre dans l'UI
 * financière passe par les guards de normalisation ci-dessous — jamais de
 * cast `as any[]` (les montants corrompus doivent tomber, pas atteindre le
 * formulaire d'encaissement).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

export type CaisseStudent = {
  first_name: string
  last_name: string
}

export type CaisseGuardian = {
  full_name: string
  phone: string
}

export type CaisseEnrollment = {
  id: string
  matricule: string | null
  students: CaisseStudent
  guardians: CaisseGuardian
  grade_levels: { name: string }
}

export type CaissePayment = {
  id: string
  amount: number
  payment_method: string
  reference: string | null
  received_at: string
  enrollments: {
    matricule: string
    students: CaisseStudent | null
    guardians: { full_name: string } | null
  } | null
}

export type CashSession = {
  id: string
  opening_amount: number
  status: string
  opened_at: string
}

export type BalanceInfo = {
  balance: number
  hasFeeItems: boolean
  nextDueAmount: number | null
  nextDueDate: string | null
}

/** Normalise la liste brute des inscriptions (dropped si ligne invalide). */
export function normalizeEnrollments(raw: unknown): CaisseEnrollment[] {
  if (!Array.isArray(raw)) return []
  const result: CaisseEnrollment[] = []
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== "string" || !isRecord(row.students)) continue
    result.push({
      id: row.id,
      matricule: asNullableString(row.matricule),
      students: {
        first_name: asString(row.students.first_name),
        last_name: asString(row.students.last_name),
      },
      guardians: isRecord(row.guardians)
        ? { full_name: asString(row.guardians.full_name), phone: asString(row.guardians.phone) }
        : { full_name: "", phone: "" },
      grade_levels: isRecord(row.grade_levels) ? { name: asString(row.grade_levels.name) } : { name: "" },
    })
  }
  return result
}

/** Normalise la liste brute des paiements (montants non finis écartés). */
export function normalizePayments(raw: unknown): CaissePayment[] {
  if (!Array.isArray(raw)) return []
  const result: CaissePayment[] = []
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== "string") continue
    if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) continue
    const enrollment = isRecord(row.enrollments) ? row.enrollments : null
    result.push({
      id: row.id,
      amount: row.amount,
      payment_method: asString(row.payment_method, "cash"),
      reference: asNullableString(row.reference),
      received_at: asString(row.received_at),
      enrollments: enrollment
        ? {
            matricule: asString(enrollment.matricule),
            students: isRecord(enrollment.students)
              ? {
                  first_name: asString(enrollment.students.first_name),
                  last_name: asString(enrollment.students.last_name),
                }
              : null,
            guardians: isRecord(enrollment.guardians)
              ? { full_name: asString(enrollment.guardians.full_name) }
              : null,
          }
        : null,
    })
  }
  return result
}

/** Normalise la session de caisse ouverte (ou null). */
export function normalizeCashSession(raw: unknown): CashSession | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null
  return {
    id: raw.id,
    opening_amount: asNumber(raw.opening_amount),
    status: asString(raw.status, "open"),
    opened_at: asString(raw.opened_at),
  }
}

/**
 * Normalise les soldes bruts (`v_student_balances`) en map indexée par
 * inscription. Les lignes sans `enrollment_id` valide sont écartées.
 */
export function normalizeBalances(raw: unknown): Record<string, BalanceInfo> {
  const map: Record<string, BalanceInfo> = {}
  if (!Array.isArray(raw)) return map
  for (const row of raw) {
    if (!isRecord(row) || typeof row.enrollment_id !== "string") continue
    map[row.enrollment_id] = {
      balance: asNumber(row.balance),
      hasFeeItems: Boolean(row.has_fee_items),
      nextDueAmount:
        typeof row.next_due_amount === "number" && Number.isFinite(row.next_due_amount)
          ? row.next_due_amount
          : null,
      nextDueDate: asNullableString(row.next_due_date),
    }
  }
  return map
}
