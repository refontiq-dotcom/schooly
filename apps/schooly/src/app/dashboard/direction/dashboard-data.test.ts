import { describe, expect, it } from "vitest"
import {
  buildFeeLookup,
  bucketPaymentsByDay,
  computeBalances,
  computeExpectedRevenue,
  computeRecoveryRate,
  getDirectionDashboard,
  percentageChange,
  pickActiveYear,
  type AcademicYearRow,
  type AdminLike,
  type EnrollmentRow,
  type FeeScheduleRow,
  type PaymentRow,
} from "./dashboard-data"

// ───────────────────────────────────────────────────── Helpers purs ────────

describe("percentageChange", () => {
  it("calcule une hausse et une baisse", () => {
    expect(percentageChange(150, 100)).toBeCloseTo(50)
    expect(percentageChange(80, 100)).toBeCloseTo(-20)
  })

  it("renvoie null sans base de comparaison (division par zéro)", () => {
    expect(percentageChange(500, 0)).toBeNull()
  })
})

describe("computeRecoveryRate", () => {
  it("calcule un taux simple", () => {
    expect(computeRecoveryRate(250, 1000)).toBeCloseTo(25)
  })

  it("borne le taux à [0, 100]", () => {
    expect(computeRecoveryRate(1500, 1000)).toBe(100)
    expect(computeRecoveryRate(-50, 1000)).toBe(0)
  })

  it("retourne 0 sans attendu", () => {
    expect(computeRecoveryRate(1000, 0)).toBe(0)
  })
})

describe("frais scolarité", () => {
  const fees: FeeScheduleRow[] = [
    { grade_level_id: "g1", financial_profile_id: null, amount: 100_000 },
    { grade_level_id: "g1", financial_profile_id: "boursier", amount: 40_000 },
    { grade_level_id: "g2", financial_profile_id: null, amount: 150_000 },
  ]

  it("privilégie le profil financier puis retombe sur le tarif standard", () => {
    const lookup = buildFeeLookup(fees)
    expect(lookup("g1", "boursier")).toBe(40_000)
    expect(lookup("g1", "inconnu")).toBe(100_000)
    expect(lookup("g1", null)).toBe(100_000)
    expect(lookup("g3", null)).toBe(0)
  })

  it("somme les frais attendus des élèves actifs", () => {
    const enrollments = [
      { grade_level_id: "g1", financial_profile_id: "boursier" },
      { grade_level_id: "g1", financial_profile_id: null },
      { grade_level_id: "g2", financial_profile_id: null },
    ] as EnrollmentRow[]
    expect(computeExpectedRevenue(enrollments, fees)).toBe(290_000)
  })
})

describe("bucketPaymentsByDay", () => {
  const now = new Date("2026-01-15T09:00:00Z")
  const payments = [
    { amount: 40_000, received_at: "2026-01-10T08:00:00Z" },
    { amount: 30_000, received_at: "2026-01-05T12:00:00Z" },
    { amount: 5_000, received_at: "2026-01-11T09:30:00Z" },
    { amount: 9_999, received_at: "2025-12-31T23:59:00Z" },
  ] as PaymentRow[]

  it("complète les jours sans encaissement à zéro", () => {
    const series = bucketPaymentsByDay(payments, 5, now)
    expect(series).toHaveLength(5)
    expect(series.map((point) => point.date)).toEqual([
      "2026-01-11",
      "2026-01-12",
      "2026-01-13",
      "2026-01-14",
      "2026-01-15",
    ])
    expect(series[0].total).toBe(5_000)
    expect(series[4].total).toBe(0)
  })

  it("agrège les paiements par jour et ignore hors fenêtre", () => {
    const series = bucketPaymentsByDay(payments, 14, now)
    const jan10 = series.find((point) => point.date === "2026-01-10")
    expect(jan10?.total).toBe(40_000)
    expect(series.reduce((sum, point) => sum + point.total, 0)).toBe(75_000)
  })
})

describe("pickActiveYear", () => {
  const years: AcademicYearRow[] = [
    { id: "y3", label: "2026-2027", status: "planifiee", start_date: "2026-09-01", end_date: "2027-06-30" },
    { id: "y2", label: "2025-2026", status: "en_cours", start_date: "2025-09-01", end_date: "2026-06-30" },
    { id: "y1", label: "2024-2025", status: "cloturee", start_date: "2024-09-01", end_date: "2025-06-30" },
  ]

  it("respecte le cookie d'année active", () => {
    expect(pickActiveYear(years, "y1")?.id).toBe("y1")
  })

  it("retombe sur l'année en cours, sinon la plus récente", () => {
    expect(pickActiveYear(years, "inconnu")?.id).toBe("y2")
    expect(pickActiveYear([years[0], years[2]])?.id).toBe("y3")
  })

  it("retourne null sans année", () => {
    expect(pickActiveYear([])).toBeNull()
  })
})

describe("computeBalances", () => {
  it("soustrait les encaissements du dû par inscription", () => {
    const enrollments = [
      { id: "e1", grade_level_id: "g1", financial_profile_id: null },
      { id: "e2", grade_level_id: "g1", financial_profile_id: null },
    ] as EnrollmentRow[]
    const fees: FeeScheduleRow[] = [
      { grade_level_id: "g1", financial_profile_id: null, amount: 100_000 },
    ]
    const payments = [
      { enrollment_id: "e1", amount: 40_000 },
      { enrollment_id: "e1", amount: 10_000 },
    ] as PaymentRow[]

    const balances = computeBalances(enrollments, payments, fees)
    expect(balances[0]).toMatchObject({ expected: 100_000, paid: 50_000, balance: 50_000 })
    expect(balances[1]).toMatchObject({ expected: 100_000, paid: 0, balance: 100_000 })
  })
})

// ───────────────────────────────────────── Loader (Supabase simulé) ────────

function fakeAdmin(dataByTable: Record<string, unknown[]>): AdminLike {
  return {
    from(table: string): unknown {
      const data = dataByTable[table] ?? []
      const builder = Object.assign(Promise.resolve({ data }), {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: data[0] ?? null }),
      })
      return builder
    },
  }
}

const FIXTURES = {
  academic_years: [
    { id: "y2", label: "2025-2026", status: "en_cours", start_date: "2025-09-01", end_date: "2026-06-30" },
    { id: "y1", label: "2024-2025", status: "cloturee", start_date: "2024-09-01", end_date: "2025-06-30" },
  ],
  enrollments: [
    { id: "e1", enrollment_date: "2025-10-01", status: "confirmed", matricule: "M1", academic_year_id: "y2", grade_level_id: "g1", financial_profile_id: null, class_id: "c1", students: { first_name: "Alice", last_name: "Koné" } },
    { id: "e2", enrollment_date: "2026-01-05", status: "confirmed", matricule: "M2", academic_year_id: "y2", grade_level_id: "g1", financial_profile_id: "p2", class_id: "c1", students: { first_name: "Bob", last_name: "Traoré" } },
    { id: "e3", enrollment_date: "2025-11-01", status: "active", matricule: "M3", academic_year_id: "y2", grade_level_id: "g2", financial_profile_id: null, class_id: null, students: { first_name: "Carol", last_name: "Diallo" } },
    { id: "e5", enrollment_date: "2026-01-06", status: "transferred", matricule: "M5", academic_year_id: "y2", grade_level_id: "g1", financial_profile_id: null, class_id: null, students: { first_name: "Eve", last_name: "Bamba" } },
    { id: "e4", enrollment_date: "2024-10-01", status: "confirmed", matricule: "M4", academic_year_id: "y1", grade_level_id: "g1", financial_profile_id: null, class_id: null, students: { first_name: "Dave", last_name: "Yao" } },
  ],
  fee_schedules: [
    { grade_level_id: "g1", financial_profile_id: null, amount: 100_000 },
    { grade_level_id: "g1", financial_profile_id: "p2", amount: 80_000 },
    { grade_level_id: "g2", financial_profile_id: null, amount: 120_000 },
  ],
  payments: [
    { id: "p1", enrollment_id: "e1", amount: 40_000, payment_method: "cash", received_at: "2026-01-10T08:00:00Z", cash_session_id: "s1", enrollments: { academic_year_id: "y2" } },
    { id: "p2", enrollment_id: "e2", amount: 30_000, payment_method: "mobile_money", received_at: "2026-01-05T12:00:00Z", cash_session_id: "s1", enrollments: { academic_year_id: "y2" } },
    { id: "p3", enrollment_id: "e1", amount: 10_000, payment_method: "cash", received_at: "2025-12-20T09:00:00Z", cash_session_id: null, enrollments: { academic_year_id: "y2" } },
    { id: "p4", enrollment_id: "e3", amount: 20_000, payment_method: "check", received_at: "2026-02-01T09:00:00Z", cash_session_id: null, enrollments: { academic_year_id: "y2" } },
    { id: "p5", enrollment_id: "e4", amount: 5_000, payment_method: "cash", received_at: "2026-01-11T09:00:00Z", cash_session_id: null, enrollments: { academic_year_id: "y1" } },
  ],
  pre_enrollments: [
    { id: "pre1", status: "pending", expires_at: "2026-01-16T09:00:00Z" },
    { id: "pre2", status: "validated", expires_at: "2026-01-20T09:00:00Z" },
  ],
  moratoriums: [
    { id: "m1", status: "pending", requested_amount: 15_000, due_date: "2026-02-01" },
    { id: "m2", status: "approved", requested_amount: 5_000, due_date: "2026-02-01" },
  ],
  dropout_alerts: [
    { id: "a1", status: "pending", detected_at: "2026-01-12T09:00:00Z" },
    { id: "a2", status: "resolved", detected_at: "2026-01-12T09:00:00Z" },
  ],
  notification_outbox: [
    { id: "n1", status: "failed" },
    { id: "n2", status: "sent" },
  ],
  cash_sessions: [
    { id: "s1", status: "open", opening_amount: 10_000, closing_amount: null, expected_amount: null, difference: null, opened_at: "2026-01-15T07:30:00Z", closed_at: null },
    { id: "s0", status: "closed", opening_amount: 5_000, closing_amount: 54_500, expected_amount: 55_000, difference: -500, opened_at: "2026-01-14T07:30:00Z", closed_at: "2026-01-14T18:00:00Z" },
  ],
  grade_levels: [
    { id: "g1", name: "6ème", level: 6, cycle: "Collège" },
    { id: "g2", name: "5ème", level: 5, cycle: "Collège" },
  ],
  classes: [
    { id: "c1", name: "6ème A", capacity: 50, grade_level_id: "g1" },
  ],
}

describe("getDirectionDashboard", () => {
  it("assemble les indicateurs de pilotage", async () => {
    const dashboard = await getDirectionDashboard(
      fakeAdmin(FIXTURES),
      "school-1",
      { now: new Date("2026-01-15T10:00:00Z") }
    )

    expect(dashboard.hasData).toBe(true)
    expect(dashboard.activeYear?.id).toBe("y2")
    expect(dashboard.previousYear?.id).toBe("y1")

    // Effectifs
    expect(dashboard.students.active).toBe(3)
    expect(dashboard.students.newThisMonth).toBe(1)
    expect(dashboard.students.previousYearActive).toBe(1)
    expect(dashboard.students.deltaCount).toBe(2)
    expect(dashboard.students.deltaPercent).toBeCloseTo(200)

    // Finance
    expect(dashboard.finance.collectedThisMonth).toBe(70_000)
    expect(dashboard.finance.collectedPreviousMonth).toBe(10_000)
    expect(dashboard.finance.collectedDeltaPercent).toBeCloseTo(600)
    expect(dashboard.finance.collectedThisYear).toBe(100_000)
    expect(dashboard.finance.expectedThisYear).toBe(300_000)
    expect(dashboard.finance.recoveryRate).toBeCloseTo(33.33, 1)
    expect(dashboard.finance.outstanding).toBe(200_000)
    expect(dashboard.finance.debtorsCount).toBe(3)
    expect(dashboard.finance.topDebtors[0]).toMatchObject({
      name: "Diallo Carol",
      balance: 100_000,
    })
    expect(dashboard.finance.byMethod).toEqual([
      { method: "cash", total: 50_000 },
      { method: "mobile_money", total: 30_000 },
      { method: "check", total: 20_000 },
    ])

    // Série journalière
    expect(dashboard.finance.daily).toHaveLength(14)
    expect(
      dashboard.finance.daily.find((point) => point.date === "2026-01-10")?.total
    ).toBe(40_000)

    // Caisse
    expect(dashboard.cash.isOpen).toBe(true)
    expect(dashboard.cash.collectedInSession).toBe(70_000)
    expect(dashboard.cash.expectedInSession).toBe(80_000)
    expect(dashboard.cash.lastDifference).toBe(-500)

    // Niveaux + taux de remplissage
    const level6 = dashboard.students.byLevel.find((level) => level.id === "g1")
    expect(level6).toMatchObject({ count: 2, capacity: 50 })
    expect(level6?.fillRate).toBeCloseTo(4)

    // File d'actions
    const queue = Object.fromEntries(
      dashboard.actionQueue.map((item) => [item.key, item])
    )
    expect(queue.pre_enrollments.count).toBe(1)
    expect(queue.pre_enrollments.detail).toContain("72 h")
    expect(queue.moratoriums.count).toBe(1)
    expect(queue.dropout_alerts.count).toBe(1)
    expect(queue.notifications.count).toBe(1)
    expect(queue.cash.count).toBe(1)
  })

  it("retourne un état vide sans donnée et sans erreur", async () => {
    const dashboard = await getDirectionDashboard(fakeAdmin({}), "school-x")
    expect(dashboard.hasData).toBe(false)
    expect(dashboard.activeYear).toBeNull()
    expect(dashboard.students.active).toBe(0)
    expect(dashboard.finance.recoveryRate).toBe(0)
    expect(dashboard.actionQueue.every((item) => item.count === 0)).toBe(true)
  })
})
