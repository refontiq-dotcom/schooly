/**
 * Données du tableau de bord Direction.
 *
 * Objectif : remplacer les cartes statiques « Modules en cours de
 * développement » par des indicateurs réels, calculés à partir du socle de
 * données existant (scolarité, caisse, recouvrement, vie scolaire).
 *
 * Deux niveaux :
 * - des helpers **purs** (aucun accès réseau, `now` injectable) : ils portent
 *   toute la logique métier (taux de recouvrement, deltas, soldes, séries) et
 *   sont couverts par des tests unitaires ;
 * - `getDirectionDashboard()` : lecture PostgREST via le client service_role,
 *   toujours scopée par `school_id`, qui assemble le modèle de la vue.
 *
 * Le client admin est injecté (paramètre `admin`) pour rester testable sans
 * variable d'environnement ni Supabase réel.
 */

type QueryResult = { data: unknown; error?: unknown; count?: number | null }

/**
 * Chaîne PostgREST minimale consommée par le loader. `then` est déclaré pour
 * que n'importe quel maillon soit « awaitable », comme le vrai client.
 *
 * On évite `any` (règle ESLint stricte de l'app) tout en gardant le client réel
 * assignable : `AdminLike.from` renvoie `unknown`, puis chaque table est
 * re-typée localement.
 */
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns?: string, options?: Record<string, unknown>) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  is: (column: string, value: unknown) => QueryBuilder
  order: (column: string, options?: Record<string, unknown>) => QueryBuilder
  limit: (count: number) => QueryBuilder
  maybeSingle: () => Promise<QueryResult>
}

export type AdminLike = {
  from: (table: string) => unknown
}

function table(admin: AdminLike, name: string): QueryBuilder {
  return admin.from(name) as QueryBuilder
}

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

export type PreEnrollmentRow = {
  id: string
  status: string
  expires_at: string
}

export type MoratoriumRow = {
  id: string
  status: string
  requested_amount: number
  due_date: string
}

export type CashSessionRow = {
  id: string
  status: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
}

export type GradeLevelRow = {
  id: string
  name: string
  level: number
  cycle: string
}

export type ClassRow = {
  id: string
  name: string
  capacity: number | null
  grade_level_id: string | null
}

// ────────────────────────────────────────────────────────── Modèle de vue ──

export type DirectionDashboard = {
  hasData: boolean
  activeYear: { id: string; label: string } | null
  previousYear: { id: string; label: string } | null
  students: {
    active: number
    newThisMonth: number
    previousYearActive: number
    deltaCount: number | null
    deltaPercent: number | null
    byLevel: Array<{
      id: string
      name: string
      cycle: string
      count: number
      capacity: number
      fillRate: number | null
    }>
  }
  finance: {
    collectedThisMonth: number
    collectedPreviousMonth: number
    collectedDeltaPercent: number | null
    collectedThisYear: number
    expectedThisYear: number
    recoveryRate: number
    outstanding: number
    debtorsCount: number
    daily: Array<{ date: string; total: number }>
    byMethod: Array<{ method: string; total: number }>
    topDebtors: Array<{
      id: string
      name: string
      matricule: string | null
      balance: number
    }>
  }
  actionQueue: Array<{
    key: string
    label: string
    detail: string | null
    count: number
    href: string | null
    tone: "warning" | "danger" | "info"
  }>
  cash: {
    isOpen: boolean
    openedAt: string | null
    openingAmount: number
    collectedInSession: number
    expectedInSession: number
    lastDifference: number | null
    lastClosedAt: string | null
  }
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

/** Solde par inscription : dû (grille) − déjà encaissé. */
export function computeBalances(
  enrollments: EnrollmentRow[],
  payments: PaymentRow[],
  feeSchedules: FeeScheduleRow[]
): Array<{ enrollment: EnrollmentRow; expected: number; paid: number; balance: number }> {
  const lookup = buildFeeLookup(feeSchedules)
  const paidByEnrollment = new Map<string, number>()
  for (const payment of payments) {
    paidByEnrollment.set(
      payment.enrollment_id,
      (paidByEnrollment.get(payment.enrollment_id) ?? 0) + payment.amount
    )
  }
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

function uniqBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const id = key(row)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(row)
    }
  }
  return out
}

// ──────────────────────────────────────────────────────────── Chargement ────

export type GetDirectionDashboardOptions = {
  /** Id de l'année mémorisée dans le cookie `active_academic_year_id`. */
  preferredYearId?: string | null
  /** Date de référence (tests / rendu serveur). */
  now?: Date
  /** Fenêtre de la série d'encaissements (jours). */
  dailyWindow?: number
}

export async function getDirectionDashboard(
  admin: AdminLike,
  schoolId: string,
  options: GetDirectionDashboardOptions = {}
): Promise<DirectionDashboard> {
  const now = options.now ?? new Date()
  const dailyWindow = options.dailyWindow ?? 14

  const [
    yearsRes,
    enrollmentsRes,
    feesRes,
    paymentsRes,
    preEnrollmentsRes,
    moratoriumsRes,
    alertsRes,
    outboxRes,
    cashRes,
    levelsRes,
    classesRes,
  ] = await Promise.all([
    table(admin, "academic_years")
      .select("id, label, status, start_date, end_date")
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    table(admin, "enrollments")
      .select(
        "id, enrollment_date, status, matricule, academic_year_id, grade_level_id, financial_profile_id, class_id, students ( first_name, last_name )"
      )
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "fee_schedules")
      .select("grade_level_id, financial_profile_id, amount")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "payments")
      .select(
        "id, enrollment_id, amount, payment_method, received_at, cash_session_id, enrollments ( academic_year_id )"
      )
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("received_at", { ascending: false }),
    table(admin, "pre_enrollments")
      .select("id, status, expires_at")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "moratoriums")
      .select("id, status, requested_amount, due_date")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "dropout_alerts")
      .select("id, status, detected_at")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "notification_outbox")
      .select("id, status")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    table(admin, "cash_sessions")
      .select(
        "id, status, opening_amount, closing_amount, expected_amount, difference, opened_at, closed_at"
      )
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(5),
    table(admin, "grade_levels")
      .select("id, name, level, cycle")
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("level", { ascending: true }),
    table(admin, "classes")
      .select("id, name, capacity, grade_level_id")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
  ])

  const years = (yearsRes?.data ?? []) as unknown as AcademicYearRow[]
  const allEnrollments = uniqBy(
    (enrollmentsRes?.data ?? []) as unknown as EnrollmentRow[],
    (row) => row.id
  )
  const feeSchedules = (feesRes?.data ?? []) as unknown as FeeScheduleRow[]
  const payments = uniqBy(
    ((paymentsRes?.data ?? []) as unknown as PaymentRow[]).filter(Boolean),
    (row) => row.id
  )
  const preEnrollments =
    (preEnrollmentsRes?.data ?? []) as unknown as PreEnrollmentRow[]
  const moratoriums = (moratoriumsRes?.data ?? []) as unknown as MoratoriumRow[]
  const alerts = (alertsRes?.data ?? []) as unknown as Array<{
    id: string
    status: string
  }>
  const outbox = (outboxRes?.data ?? []) as unknown as Array<{
    id: string
    status: string
  }>
  const sessions = (cashRes?.data ?? []) as unknown as CashSessionRow[]
  const levels = (levelsRes?.data ?? []) as unknown as GradeLevelRow[]
  const classes = (classesRes?.data ?? []) as unknown as ClassRow[]

  const activeYear = pickActiveYear(years, options.preferredYearId)
  const activeYearIndex = activeYear
    ? years.findIndex((year) => year.id === activeYear.id)
    : -1
  const previousYear =
    activeYearIndex >= 0 ? years[activeYearIndex + 1] ?? null : null

  const activeYearEnrollments = activeYear
    ? allEnrollments.filter((e) => e.academic_year_id === activeYear.id)
    : []
  const activeEnrollments = activeYearEnrollments.filter(
    (e) => e.status === "confirmed" || e.status === "active"
  )
  const previousYearActive = previousYear
    ? allEnrollments.filter(
        (e) =>
          e.academic_year_id === previousYear.id &&
          (e.status === "confirmed" || e.status === "active")
      ).length
    : 0

  // ── Effectifs ──────────────────────────────────────────────────────────
  const monthStart = isoDateUTC(startOfMonthUTC(now))
  const newThisMonth = activeEnrollments.filter(
    (e) => (e.enrollment_date ?? "").slice(0, 10) >= monthStart
  ).length
  const deltaCount =
    previousYear !== null ? activeEnrollments.length - previousYearActive : null
  const deltaPercent =
    previousYear !== null
      ? percentageChange(activeEnrollments.length, previousYearActive)
      : null

  const capacityByLevel = new Map<string, number>()
  for (const cls of classes) {
    if (!cls.grade_level_id || cls.capacity == null) continue
    capacityByLevel.set(
      cls.grade_level_id,
      (capacityByLevel.get(cls.grade_level_id) ?? 0) + cls.capacity
    )
  }
  const levelCounts = new Map<string, number>()
  for (const enrollment of activeEnrollments) {
    levelCounts.set(
      enrollment.grade_level_id,
      (levelCounts.get(enrollment.grade_level_id) ?? 0) + 1
    )
  }
  const byLevel = levels
    .map((level) => {
      const count = levelCounts.get(level.id) ?? 0
      const capacity = capacityByLevel.get(level.id) ?? 0
      return {
        id: level.id,
        name: level.name,
        cycle: level.cycle,
        count,
        capacity,
        fillRate: capacity > 0 ? Math.min(100, (count / capacity) * 100) : null,
      }
    })
    .filter((level) => level.count > 0 || level.capacity > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))

  // ── Finance ────────────────────────────────────────────────────────────
  // Tout est ancré sur l'année active : sans ce filtre, un chevauchement de
  // deux années (bascule N/N+1, §7.9 du cahier des charges) mélangerait les
  // encaissements de deux exercices dans les mêmes totaux. On s'appuie sur
  // l'inscription rattachée, `payments` ne portant pas l'année en propre.
  const activeYearPayments = activeYear
    ? payments.filter(
        (p) => p.enrollments?.academic_year_id === activeYear.id
      )
    : []

  const currentMonthStart = startOfMonthUTC(now)
  const previousMonthStart = addMonthsUTC(currentMonthStart, -1)
  const nextMonthStart = addMonthsUTC(currentMonthStart, 1)

  const paymentsThisMonth = activeYearPayments.filter((p) => {
    const at = new Date(p.received_at)
    return at >= currentMonthStart && at < nextMonthStart
  })
  const paymentsPreviousMonth = activeYearPayments.filter((p) => {
    const at = new Date(p.received_at)
    return at >= previousMonthStart && at < currentMonthStart
  })
  const collectedThisMonth = sumAmounts(paymentsThisMonth)
  const collectedPreviousMonth = sumAmounts(paymentsPreviousMonth)
  const collectedDeltaPercent = percentageChange(
    collectedThisMonth,
    collectedPreviousMonth
  )

  const collectedThisYear = sumAmounts(activeYearPayments)
  const expectedThisYear = computeExpectedRevenue(activeEnrollments, feeSchedules)
  const recoveryRate = computeRecoveryRate(collectedThisYear, expectedThisYear)

  const balances = computeBalances(activeEnrollments, payments, feeSchedules)
  const debtors = balances
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const outstanding = debtors.reduce((total, entry) => total + entry.balance, 0)

  const methodTotals = new Map<string, number>()
  for (const payment of activeYearPayments) {
    const method = payment.payment_method ?? "autre"
    methodTotals.set(method, (methodTotals.get(method) ?? 0) + payment.amount)
  }
  const byMethod = Array.from(methodTotals, ([method, total]) => ({
    method,
    total,
  })).sort((a, b) => b.total - a.total)

  const topDebtors = debtors.slice(0, 5).map((entry) => ({
    id: entry.enrollment.id,
    name: studentName(entry.enrollment),
    matricule: entry.enrollment.matricule,
    balance: entry.balance,
  }))

  // ── File d'actions ─────────────────────────────────────────────────────
  const expiringThreshold = addDaysUTC(now, 3).getTime()
  const pendingPreEnrollments = preEnrollments.filter(
    (p) => p.status === "pending"
  )
  const expiringPreEnrollments = pendingPreEnrollments.filter(
    (p) =>
      p.expires_at != null &&
      new Date(p.expires_at).getTime() <= expiringThreshold
  ).length
  const pendingMoratoriums = moratoriums.filter(
    (m) => m.status === "pending"
  )
  const pendingMoratoriumsAmount = pendingMoratoriums.reduce(
    (total, m) => total + (m.requested_amount ?? 0),
    0
  )
  const pendingAlerts = alerts.filter((a) => a.status === "pending").length
  const failedNotifications = outbox.filter(
    (o) => o.status === "failed"
  ).length
  const openSession = sessions.find((s) => s.status === "open") ?? null
  const collectedInSession = openSession
    ? sumAmounts(
        payments.filter((p) => p.cash_session_id === openSession.id)
      )
    : 0
  const lastClosed = sessions.find((s) => s.status !== "open") ?? null

  const actionQueue: DirectionDashboard["actionQueue"] = [
    {
      key: "pre_enrollments",
      label: "Pré-inscriptions à valider",
      detail:
        expiringPreEnrollments > 0
          ? `dont ${expiringPreEnrollments} expirent sous 72 h`
          : null,
      count: pendingPreEnrollments.length,
      href: "/dashboard/direction/admissions",
      tone: "warning",
    },
    {
      key: "moratoriums",
      label: "Moratoires à arbitrer",
      detail:
        pendingMoratoriumsAmount > 0
          ? `${pendingMoratoriumsAmount.toLocaleString("fr-FR")} FCFA demandés`
          : null,
      count: pendingMoratoriums.length,
      href: "/dashboard/direction/finance/moratoriums",
      tone: "warning",
    },
    {
      key: "dropout_alerts",
      label: "Alertes décrochage à traiter",
      detail: null,
      count: pendingAlerts,
      href: null,
      tone: "danger",
    },
    {
      key: "notifications",
      label: "Relances en échec",
      detail: failedNotifications > 0 ? "Canal SMS / WhatsApp à vérifier" : null,
      count: failedNotifications,
      href: "/dashboard/direction/finance/reminders",
      tone: "danger",
    },
    {
      key: "cash",
      label: "Session de caisse à clôturer",
      detail: openSession
        ? `Ouverte depuis le ${new Date(openSession.opened_at).toLocaleDateString("fr-FR")}`
        : null,
      count: openSession ? 1 : 0,
      href: "/dashboard/caisse/close",
      tone: "info",
    },
  ]

  return {
    hasData: years.length > 0 || allEnrollments.length > 0,
    activeYear: activeYear
      ? { id: activeYear.id, label: activeYear.label }
      : null,
    previousYear: previousYear
      ? { id: previousYear.id, label: previousYear.label }
      : null,
    students: {
      active: activeEnrollments.length,
      newThisMonth,
      previousYearActive,
      deltaCount,
      deltaPercent,
      byLevel,
    },
    finance: {
      collectedThisMonth,
      collectedPreviousMonth,
      collectedDeltaPercent,
      collectedThisYear,
      expectedThisYear,
      recoveryRate,
      outstanding,
      debtorsCount: debtors.length,
      // série complétée à 0 pour les jours sans encaissement (pas de trou)
      daily: bucketPaymentsByDay(activeYearPayments, dailyWindow, now),
      byMethod,
      topDebtors,
    },
    actionQueue,
    cash: {
      isOpen: openSession != null,
      openedAt: openSession?.opened_at ?? null,
      openingAmount: openSession?.opening_amount ?? 0,
      collectedInSession,
      expectedInSession: openSession
        ? (openSession.opening_amount ?? 0) + collectedInSession
        : 0,
      lastDifference: lastClosed?.difference ?? null,
      lastClosedAt: lastClosed?.closed_at ?? null,
    },
  }
}
