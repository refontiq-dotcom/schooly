import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getDirectionDashboard,
  type AdminLike,
} from "./dashboard-data"
import {
  buildFeeLookup,
  bucketPaymentsByDay,
  computeBalances,
  computeExpectedRevenue,
  computeRecoveryRate,
  paidTotalsByEnrollment,
  percentageChange,
  pickActiveYear,
  sumAmountsByMethod,
  type AcademicYearRow,
  type EnrollmentRow,
  type FeeScheduleRow,
  type PaymentRow,
} from "./dashboard-helpers"
import type { RpcCall } from "./financial-kpis"

// P1-B : le loader passe par `unstable_cache` (Data Cache Next) — hors
// runtime Next en test unitaire, on exécute la fonction brute (pas de cache).
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }))

// Les espions de journal (console.warn) ne doivent pas fuir d'un test à l'autre.
afterEach(() => {
  vi.restoreAllMocks()
})

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

    const balances = computeBalances(
      enrollments,
      paidTotalsByEnrollment(payments),
      fees
    )
    expect(balances[0]).toMatchObject({ expected: 100_000, paid: 50_000, balance: 50_000 })
    expect(balances[1]).toMatchObject({ expected: 100_000, paid: 0, balance: 100_000 })
  })
})

describe("paidTotalsByEnrollment", () => {
  it("cumul par inscription et laisse les autres sans entrée", () => {
    const totals = paidTotalsByEnrollment([
      { enrollment_id: "e1", amount: 40_000 },
      { enrollment_id: "e2", amount: 0 },
      { enrollment_id: "e1", amount: 10_000 },
    ] as PaymentRow[])

    expect(totals.get("e1")).toBe(50_000)
    expect(totals.get("e2")).toBe(0)
    expect(totals.has("e3")).toBe(false)
  })
})

describe("sumAmountsByMethod", () => {
  it("ventile du plus fort au plus faible et rattache « autre » par défaut", () => {
    const byMethod = sumAmountsByMethod([
      { amount: 12_000, payment_method: null },
      { amount: 40_000, payment_method: "cash" },
      { amount: 10_000, payment_method: "cash" },
      { amount: 30_000, payment_method: "mobile_money" },
    ])

    expect(byMethod).toEqual([
      { method: "cash", total: 50_000 },
      { method: "mobile_money", total: 30_000 },
      { method: "autre", total: 12_000 },
    ])
  })

  it("traite un montant null comme 0 sans perdre le mode", () => {
    expect(sumAmountsByMethod([{ amount: null, payment_method: "check" }])).toEqual(
      [{ method: "check", total: 0 }]
    )
  })
})

// ───────────────────────────────────────── Loader (Supabase simulé) ────────

function fakeAdmin(
  dataByTable: Record<string, unknown[]>,
  rpc?: AdminLike["rpc"]
): AdminLike {
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
    // `rpc` absent = client sans RPC : le loader retombe sur l'agrégation JS.
    ...(rpc === undefined ? {} : { rpc }),
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

/**
 * RPC simulée pour le loader : enregistre ses appels (nom + arguments) et
 * renvoie l'enveloppe fournie (`data` / `error`) — même contrat que PostgREST.
 */
function fakeRpcEnvelope(response: {
  data: unknown
  error: { message: string } | null
}): { rpc: RpcCall; calls: Array<{ name: string; args: Record<string, unknown> }> } {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: RpcCall = (name, args) => {
    calls.push({ name, args })
    return Promise.resolve(response)
  }
  return { rpc, calls }
}

/**
 * RPC simulée multi-fonctions : chaque nom reçoit sa propre enveloppe, une
 * fonction inconnue est traitée comme une erreur base. Permet d'éprouver le
 * chemin nominal (les deux agrégats disponibles) puis chaque repli isolément.
 */
function fakeRpcByName(
  responses: Record<
    string,
    { data: unknown; error: { message: string } | null }
  >
): { rpc: RpcCall; calls: Array<{ name: string; args: Record<string, unknown> }> } {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: RpcCall = (name, args) => {
    calls.push({ name, args })
    const response = responses[name]
    if (response === undefined) {
      return Promise.resolve({
        data: null,
        error: { message: `RPC inconnue : ${name}` },
      })
    }
    return Promise.resolve(response)
  }
  return { rpc, calls }
}

/** Charge utile « chemin nominal » des deux RPC d'agrégats. */
const RPC_OK = {
  get_direction_financial_kpis: {
    data: {
      collected_this_year: 480_000,
      collected_this_month: 120_000,
      collected_previous_month: 60_000,
      by_method: [{ method: "mobile_money", total: 480_000 }],
      daily_series: [
        { date: "2026-01-14", total: 0 },
        { date: "2026-01-15", total: 120_000 },
      ],
    },
    error: null,
  },
  // Volontairement différents des lignes de paiement des fixtures : si le loader
  // retombait sur son scan JS, les soldes et le total de session seraient autres.
  get_direction_balance_kpis: {
    data: {
      enrollment_paid: [
        { enrollment_id: "e1", paid: 45_000 },
        { enrollment_id: "e2", paid: 30_000 },
        { enrollment_id: "e3", paid: 10_000 },
      ],
      session_paid: 66_000,
    },
    error: null,
  },
} as const

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

  it("sert KPI et soldes depuis les RPC sans jamais lire la table payments", async () => {
    const { rpc, calls } = fakeRpcByName(RPC_OK)
    const admin = fakeAdmin(FIXTURES, rpc)
    const fromSpy = vi.spyOn(admin, "from")

    const dashboard = await getDirectionDashboard(admin, "school-1", {
      now: new Date("2026-01-15T10:00:00Z"),
    })

    // S1 : le scan JS de `payments` a disparu du chemin nominal.
    expect(fromSpy.mock.calls.map(([name]) => name)).not.toContain("payments")

    // Les deux RPC sont interrogées, chacune avec ses paramètres.
    expect(calls).toEqual([
      {
        name: "get_direction_financial_kpis",
        args: {
          p_school_id: "school-1",
          p_academic_year_id: "y2",
          p_now: "2026-01-15T10:00:00.000Z",
          p_daily_window: 14,
        },
      },
      {
        name: "get_direction_balance_kpis",
        args: {
          p_school_id: "school-1",
          p_academic_year_id: "y2",
          p_cash_session_id: "s1",
        },
      },
    ])

    // Totaux et ventilations issus de la base…
    expect(dashboard.finance.collectedThisYear).toBe(480_000)
    expect(dashboard.finance.collectedThisMonth).toBe(120_000)
    expect(dashboard.finance.collectedPreviousMonth).toBe(60_000)
    // … le delta restant dérivé des deux bornes mensuelles.
    expect(dashboard.finance.collectedDeltaPercent).toBeCloseTo(100)
    expect(dashboard.finance.byMethod).toEqual([
      { method: "mobile_money", total: 480_000 },
    ])
    expect(dashboard.finance.daily).toHaveLength(2)

    // Soldes et caisse issus des soldes agrégés (45k / 30k / 10k par inscription).
    expect(dashboard.finance.expectedThisYear).toBe(300_000)
    expect(dashboard.finance.outstanding).toBe(215_000)
    expect(dashboard.finance.debtorsCount).toBe(3)
    expect(dashboard.finance.topDebtors[0]).toMatchObject({
      name: "Diallo Carol",
      balance: 110_000,
    })
    expect(dashboard.cash.collectedInSession).toBe(66_000)
    expect(dashboard.finance.recoveryRate).toBe(100)
  })

  it("retombe sur les lignes de paiement quand la RPC des soldes échoue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpcByName({
      get_direction_financial_kpis: RPC_OK.get_direction_financial_kpis,
      get_direction_balance_kpis: { data: null, error: { message: "boom" } },
    })
    const admin = fakeAdmin(FIXTURES, rpc)
    const fromSpy = vi.spyOn(admin, "from")

    const dashboard = await getDirectionDashboard(admin, "school-1", {
      now: new Date("2026-01-15T10:00:00Z"),
    })

    // Les KPI restent ceux de la base…
    expect(dashboard.finance.collectedThisYear).toBe(480_000)
    // … mais soldes et caisse retombent sur les lignes de paiement.
    expect(fromSpy.mock.calls.map(([name]) => name)).toContain("payments")
    expect(dashboard.finance.outstanding).toBe(200_000)
    expect(dashboard.cash.collectedInSession).toBe(70_000)
    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes("direction.balance_kpis_rpc_failed")
      )
    ).toBe(true)
  })

  it("rejette des soldes citant des inscriptions inconnues du tableau de bord", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpcByName({
      get_direction_financial_kpis: RPC_OK.get_direction_financial_kpis,
      get_direction_balance_kpis: {
        data: {
          enrollment_paid: [{ enrollment_id: "inconnue", paid: 500_000 }],
          session_paid: 66_000,
        },
        error: null,
      },
    })

    const dashboard = await getDirectionDashboard(
      fakeAdmin(FIXTURES, rpc),
      "school-1",
      { now: new Date("2026-01-15T10:00:00Z") }
    )

    // Un identifiant hors du jeu de lignes = soldes incohérents : repli plutôt
    // qu'un encours nul silencieusement faux.
    expect(dashboard.finance.outstanding).toBe(200_000)
    expect(dashboard.cash.collectedInSession).toBe(70_000)
    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes("direction.balance_kpis_unmatched")
      )
    ).toBe(true)
  })

  it("retombe sur l'agrégation JS quand la RPC échoue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpcEnvelope({
      data: null,
      error: { message: "boom" },
    })

    const dashboard = await getDirectionDashboard(
      fakeAdmin(FIXTURES, rpc),
      "school-1",
      { now: new Date("2026-01-15T10:00:00Z") }
    )

    expect(dashboard.finance.collectedThisYear).toBe(100_000)
    expect(dashboard.finance.collectedThisMonth).toBe(70_000)
    expect(dashboard.finance.byMethod).toEqual([
      { method: "cash", total: 50_000 },
      { method: "mobile_money", total: 30_000 },
      { method: "check", total: 20_000 },
    ])
    expect(dashboard.finance.daily).toHaveLength(14)
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.financial_kpis_rpc_failed"
    )
  })

  it("retombe sur l'agrégation JS si la charge utile RPC est invalide", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpcEnvelope({
      data: { collected_this_year: "480000" },
      error: null,
    })

    const dashboard = await getDirectionDashboard(
      fakeAdmin(FIXTURES, rpc),
      "school-1",
      { now: new Date("2026-01-15T10:00:00Z") }
    )

    expect(dashboard.finance.collectedThisYear).toBe(100_000)
    expect(dashboard.finance.collectedThisMonth).toBe(70_000)
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.financial_kpis_rpc_invalid"
    )
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
