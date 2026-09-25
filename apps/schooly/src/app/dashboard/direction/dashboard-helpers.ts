/**
 * Helpers purs du tableau de bord Direction.
 *
 * Isolés de `dashboard-data.ts` (charge PostgREST + assemblage du modèle) pour
 * que chaque fichier reste sous le plafond de lisibilité : aucune de ces
 * fonctions ne touche au réseau, le temps est toujours injecté en paramètre,
 * et chacune est couverte par un test unitaire.
 *
 * Les types de lignes utilisées par ces helpers sont déclarés ici : le loader
 * les importe, jamais l'inverse — aucun cycle entre les deux modules.
 */

// ─────────────────────────────────────────────────────────── Lignes brutes ──

export type AcademicYearRow = {
  id: string
  label: string
  status: string
  start_date: string
  end_date: string
}

export type EnrollmentRow = {
  id: string
  enrollment_date: string
  status: string
  matricule: string | null
  academic_year_id: string
  grade_level_id: string
  financial_profile_id: string | null
  class_id: string | null
  students: { first_name: string; last_name: string } | null
}

export type FeeScheduleRow = {
  grade_level_id: string | null
  financial_profile_id: string | null
  amount: number
}

export type PaymentRow = {
  id: string
  enrollment_id: string
  amount: number
  payment_method: string | null
  received_at: string
  cash_session_id: string | null
  enrollments: { academic_year_id: string } | null
}

// ─────────────────────────────────────────────────────── Helpers de date ────

export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfMonthUTC(reference: Date): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)
  )
}

export function addMonthsUTC(reference: Date, months: number): Date {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + months,
      1
    )
  )
}

export function addDaysUTC(reference: Date, days: number): Date {
  return new Date(reference.getTime() + days * DAY_MS)
}

export function isoDateUTC(reference: Date): string {
  return reference.toISOString().slice(0, 10)
}

// ───────────────────────────────────────────────────────── Helpers purs ────

export function sumAmounts(rows: Array<{ amount: number | null }>): number {
  return rows.reduce((total, row) => total + (row.amount ?? 0), 0)
}

/**
 * Ventilation des encaissements par mode de paiement, du plus fort au plus
 * faible. `payment_method` absent est rattaché à « autre » (défaut métier) :
 * on ne perd jamais un montant encaissé faute de mode renseigné.
 */
export function sumAmountsByMethod(
  rows: Array<{ amount: number | null; payment_method: string | null }>
): Array<{ method: string; total: number }> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const method = row.payment_method ?? "autre"
    totals.set(method, (totals.get(method) ?? 0) + (row.amount ?? 0))
  }
  return Array.from(totals, ([method, total]) => ({ method, total })).sort(
    (a, b) => b.total - a.total
  )
}

/**
 * Variation relative entre deux valeurs. `previous = 0` n'a pas de pourcentage
 * interprétable (division par zéro) → `null` : l'UI affiche « nouveau » plutôt
 * qu'un « +∞ % » trompeur.
 */
export function percentageChange(
  current: number,
  previous: number
): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

/** Taux de recouvrement borné à [0, 100] : un surplus ne « masque » pas un impayé. */
export function computeRecoveryRate(collected: number, expected: number): number {
  if (expected <= 0) return 0
  return Math.min(100, Math.max(0, (collected / expected) * 100))
}

/**
 * Index des frais scolarité : clé `niveau|profil` puis repli `niveau|` (profil
 * standard). Renvoie le montant dû pour un couple (niveau, profil financier).
 */
export function buildFeeLookup(feeSchedules: FeeScheduleRow[]) {
  const byProfile = new Map<string, number>()
  const standard = new Map<string, number>()
  for (const fee of feeSchedules) {
    if (!fee.grade_level_id) continue
    if (fee.financial_profile_id) {
      byProfile.set(`${fee.grade_level_id}|${fee.financial_profile_id}`, fee.amount)
    } else {
      standard.set(fee.grade_level_id, fee.amount)
    }
  }
  return (gradeLevelId: string, financialProfileId: string | null): number => {
    if (financialProfileId) {
      const specific = byProfile.get(`${gradeLevelId}|${financialProfileId}`)
      if (specific !== undefined) return specific
    }
    return standard.get(gradeLevelId) ?? 0
  }
}

/** Somme attendue des frais pour une liste d'inscriptions (une par élève actif). */
export function computeExpectedRevenue(
  enrollments: EnrollmentRow[],
  feeSchedules: FeeScheduleRow[]
): number {
  const lookup = buildFeeLookup(feeSchedules)
  return enrollments.reduce(
    (total, enrollment) =>
      total + lookup(enrollment.grade_level_id, enrollment.financial_profile_id),
    0
  )
}

/**
 * Séries journalières (N derniers jours, aujourd'hui inclus). Les jours sans
 * encaissement restent à 0 pour éviter une courbe qui « saute » les trous.
 */
export function bucketPaymentsByDay(
  payments: PaymentRow[],
  days: number,
  now: Date
): Array<{ date: string; total: number }> {
  const buckets = new Map<string, number>()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(isoDateUTC(addDaysUTC(today, -i)), 0)
  }
  for (const payment of payments) {
    const key = payment.received_at.slice(0, 10)
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + payment.amount)
    }
  }
  return Array.from(buckets, ([date, total]) => ({ date, total }))
}

/**
 * Sélection de l'année active : cookie explicite, sinon année « en_cours »,
 * sinon la plus récente. `years` doit être trié par `start_date` décroissant.
 */
export function pickActiveYear(
  years: AcademicYearRow[],
  preferredId?: string | null
): AcademicYearRow | null {
  if (years.length === 0) return null
  if (preferredId) {
    const selected = years.find((year) => year.id === preferredId)
    if (selected) return selected
  }
  return years.find((year) => year.status === "en_cours") ?? years[0]
}

/**
 * Total encaissé par inscription, à partir des lignes de paiement. Réservé au
 * chemin de repli : quand la RPC répond, la même information arrive déjà
 * agrégée (une entrée par inscription créditée) et le scan est évité.
 */
export function paidTotalsByEnrollment(
  payments: PaymentRow[]
): Map<string, number> {
  const paidByEnrollment = new Map<string, number>()
  for (const payment of payments) {
    paidByEnrollment.set(
      payment.enrollment_id,
      (paidByEnrollment.get(payment.enrollment_id) ?? 0) + payment.amount
    )
  }
  return paidByEnrollment
}

/** Solde par inscription : dû (grille) − déjà encaissé. */
export function computeBalances(
  enrollments: EnrollmentRow[],
  paidByEnrollment: ReadonlyMap<string, number>,
  feeSchedules: FeeScheduleRow[]
): Array<{ enrollment: EnrollmentRow; expected: number; paid: number; balance: number }> {
  const lookup = buildFeeLookup(feeSchedules)
  return enrollments.map((enrollment) => {
    const expected = lookup(
      enrollment.grade_level_id,
      enrollment.financial_profile_id
    )
    const paid = paidByEnrollment.get(enrollment.id) ?? 0
    return { enrollment, expected, paid, balance: expected - paid }
  })
}

export function studentName(enrollment: EnrollmentRow): string {
  const first = enrollment.students?.first_name ?? ""
  const last = enrollment.students?.last_name ?? ""
  const full = `${last} ${first}`.trim()
  return full || enrollment.matricule || "Élève"
}
