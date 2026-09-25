/**
 * Données du tableau de bord Direction.
 *
 * Objectif : remplacer les cartes statiques « Modules en cours de
 * développement » par des indicateurs réels, calculés à partir du socle de
 * données existant (scolarité, caisse, recouvrement, vie scolaire).
 *
 * Deux niveaux :
 * - des helpers **purs** dans `dashboard-helpers.ts` (aucun accès réseau, `now`
 *   injectable) : ils portent toute la logique métier (taux de recouvrement,
 *   deltas, soldes, séries) et sont couverts par des tests unitaires ;
 * - `getDirectionDashboard()` : lecture PostgREST via le client service_role,
 *   toujours scopée par `school_id`, qui assemble le modèle de la vue.
 *
 * Le client admin est injecté (paramètre `admin`) pour rester testable sans
 * variable d'environnement ni Supabase réel.
 */

import { unstable_cache } from "next/cache"
import {
  DIRECTION_DASHBOARD_CACHE_TAG,
  READ_CACHE_TTL_SECONDS,
} from "@/lib/cache-tags"
import { logServerEvent } from "@/lib/server-logger"
import {
  addDaysUTC,
  addMonthsUTC,
  bucketPaymentsByDay,
  computeBalances,
  computeExpectedRevenue,
  computeRecoveryRate,
  isoDateUTC,
  paidTotalsByEnrollment,
  percentageChange,
  pickActiveYear,
  startOfMonthUTC,
  studentName,
  sumAmounts,
  sumAmountsByMethod,
  type AcademicYearRow,
  type EnrollmentRow,
  type FeeScheduleRow,
  type PaymentRow,
} from "./dashboard-helpers"
import {
  loadDirectionBalanceKpis,
  loadDirectionFinancialKpis,
  type RpcCall,
} from "./financial-kpis"

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
  /**
   * Appel RPC PostgREST optionnel : les consommateurs qui ne l'exposent pas
   * (client dégradé, fixtures de test) conservent l'agrégation JS.
   */
  rpc?: RpcCall
}

function table(admin: AdminLike, name: string): QueryBuilder {
  return admin.from(name) as QueryBuilder
}

// ─────────────────────────────────────────────────────────── Lignes brutes ──

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
  activeYear: { id: string; label: string; startDate: string; endDate: string } | null
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

  // P1-B : les lectures PostgREST passent par le Data Cache, clé scoppée
  // par école, purgé par tag à chaque mutation (`updateTag`) avec un TTL de
  // sécurité de 60 s pour les écritures non tagguées. Le client `admin`
  // reste dans la fermeture : non sérialisable, il ne fait pas partie de la
  // clé (seul `schoolId` identifie le jeu de données).
  //
  // `payments` n'y figure plus (S1) : ses agrégats sont demandés aux RPC, et la
  // lecture complète n'est relancée qu'en repli (voir `loadFallbackPayments`).
  const loadDashboardRows = unstable_cache(
    async () =>
      Promise.all([
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
      ]),
    ["direction-dashboard-rows", schoolId],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [DIRECTION_DASHBOARD_CACHE_TAG] }
  )

  // Repli dégradé : lecture intégrale des encaissements, dans un jeton de cache
  // distinct (même tag) pour qu'elle ne soit jamais mémorisée quand les RPC
  // répondent. Conserve l'exactitude historique du dashboard si la base refuse
  // les agrégats, au prix du scan que S1 cherche à supprimer.
  const loadFallbackPayments = unstable_cache(
    async () =>
      table(admin, "payments")
        .select(
          "id, enrollment_id, amount, payment_method, received_at, cash_session_id, enrollments ( academic_year_id )"
        )
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .order("received_at", { ascending: false }),
    ["direction-dashboard-payments-fallback", schoolId],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [DIRECTION_DASHBOARD_CACHE_TAG] }
  )

  const [
    yearsRes,
    enrollmentsRes,
    feesRes,
    preEnrollmentsRes,
    moratoriumsRes,
    alertsRes,
    outboxRes,
    cashRes,
    levelsRes,
    classesRes,
  ] = await loadDashboardRows()

  const years = (yearsRes?.data ?? []) as unknown as AcademicYearRow[]
  const allEnrollments = uniqBy(
    (enrollmentsRes?.data ?? []) as unknown as EnrollmentRow[],
    (row) => row.id
  )
  const feeSchedules = (feesRes?.data ?? []) as unknown as FeeScheduleRow[]
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
  // S1 : plus aucun agrégat de ce dashboard n'est recalculé en JS à partir des
  // lignes de paiement. Deux RPC renvoient des totaux déjà agrégés en base, et
  // sont interrogées en parallèle — `get_direction_financial_kpis` (cumul
  // exercice, M vs M-1, ventilation par mode, série journalière) et
  // `get_direction_balance_kpis` (total encaissé par inscription, total de la
  // session de caisse). Le module `financial-kpis` porte l'appel, la validation
  // du JSONB et le cache. Le chemin nominal ne transporte plus qu'une entrée par
  // élève crédité, au lieu de toutes les lignes de paiement.
  const openSession = sessions.find((s) => s.status === "open") ?? null
  const [financialKpis, balanceKpis] = activeYear
    ? await Promise.all([
        loadDirectionFinancialKpis(admin.rpc ?? null, {
          schoolId,
          academicYearId: activeYear.id,
          now,
          dailyWindow,
        }),
        loadDirectionBalanceKpis(admin.rpc ?? null, {
          schoolId,
          academicYearId: activeYear.id,
          cashSessionId: openSession?.id ?? null,
        }),
      ])
    : [null, null]

  const activeYearEnrollments = activeYear
    ? allEnrollments.filter((e) => e.academic_year_id === activeYear.id)
    : []

  // Un solde incohérent — identifiants d'inscription inconnus du jeu de lignes —
  // afficherait un encours nul sans aucun signal : on le traite donc comme un
  // échec de RPC (journal + repli), plutôt que comme une donnée fiable.
  const yearEnrollmentIds = new Set(
    activeYearEnrollments.map((enrollment) => enrollment.id)
  )
  const balancesAreConsistent =
    balanceKpis === null ||
    balanceKpis.enrollmentPaid.every((row) =>
      yearEnrollmentIds.has(row.enrollmentId)
    )
  if (balanceKpis !== null && !balancesAreConsistent) {
    logServerEvent("warn", "direction.balance_kpis_unmatched", {
      schoolId,
      academicYearId: activeYear?.id ?? "none",
    })
  }
  const usableBalanceKpis = balancesAreConsistent ? balanceKpis : null

  // Le repli n'est lu que si un agrégat manque : client sans RPC, erreur base,
  // charge utile invalide ou soldes incohérents.
  const payments =
    financialKpis !== null && usableBalanceKpis !== null
      ? []
      : uniqBy(
          (
            ((await loadFallbackPayments())?.data ??
              []) as unknown as PaymentRow[]
          ).filter(Boolean),
          (row) => row.id
        )
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
  // KPI en base quand disponibles, repli sur l'agrégation JS sinon. Le delta
  // reste dérivé des deux totaux retenus : une seule formule, quelle que soit
  // la source (mêmes bornes mensuelles UTC des deux côtés).
  const collectedThisMonth =
    financialKpis?.collectedThisMonth ?? sumAmounts(paymentsThisMonth)
  const collectedPreviousMonth =
    financialKpis?.collectedPreviousMonth ?? sumAmounts(paymentsPreviousMonth)
  const collectedDeltaPercent = percentageChange(
    collectedThisMonth,
    collectedPreviousMonth
  )

  const collectedThisYear =
    financialKpis?.collectedThisYear ?? sumAmounts(activeYearPayments)
  const expectedThisYear = computeExpectedRevenue(activeEnrollments, feeSchedules)
  const recoveryRate = computeRecoveryRate(collectedThisYear, expectedThisYear)

  // Soldes : source unique, soit les totaux agrégés par la base, soit le repli
  // calculé sur les lignes de paiement.
  const paidByEnrollment = usableBalanceKpis
    ? new Map(
        usableBalanceKpis.enrollmentPaid.map((row) => [row.enrollmentId, row.paid])
      )
    : paidTotalsByEnrollment(payments)
  const balances = computeBalances(
    activeEnrollments,
    paidByEnrollment,
    feeSchedules
  )
  const debtors = balances
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const outstanding = debtors.reduce((total, entry) => total + entry.balance, 0)

  const byMethod = financialKpis?.byMethod ?? sumAmountsByMethod(activeYearPayments)

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
  const collectedInSession = openSession
    ? (usableBalanceKpis?.sessionPaid ??
      sumAmounts(payments.filter((p) => p.cash_session_id === openSession.id)))
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
      ? { id: activeYear.id, label: activeYear.label, startDate: activeYear.start_date, endDate: activeYear.end_date }
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
      // série complétée à 0 pour les jours sans encaissement (pas de trou) :
      // calculée en base quand la RPC répond, sinon en JS sur les paiements
      daily:
        financialKpis?.daily ?? bucketPaymentsByDay(activeYearPayments, dailyWindow, now),
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
