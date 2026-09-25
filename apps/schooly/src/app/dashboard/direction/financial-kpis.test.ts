import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DIRECTION_BALANCE_KPIS_RPC,
  DIRECTION_FINANCIAL_KPIS_RPC,
  fetchDirectionBalanceKpis,
  fetchDirectionFinancialKpis,
  loadDirectionBalanceKpis,
  loadDirectionFinancialKpis,
  parseBalanceKpis,
  parseFinancialKpis,
  type RpcCall,
} from "./financial-kpis"

// Le wrapper `unstable_cache` (Data Cache Next) n'existe pas hors runtime Next :
// on exécute la fonction brute, ce qui teste bien l'appel RPC et sa clé.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }))

const PARAMS = {
  schoolId: "school-1",
  academicYearId: "y2",
  now: new Date("2026-01-15T10:00:00Z"),
  dailyWindow: 14,
}

const PAYLOAD = {
  collected_this_year: 250_000,
  collected_this_month: 70_000,
  collected_previous_month: 10_000,
  by_method: [
    { method: "cash", total: 50_000 },
    { method: "mobile_money", total: 30_000 },
  ],
  daily_series: [
    { date: "2026-01-14", total: 0 },
    { date: "2026-01-15", total: 40_000 },
  ],
}

const BALANCE_PARAMS = {
  schoolId: "school-1",
  academicYearId: "y2",
  cashSessionId: "s1",
}

const BALANCE_PAYLOAD = {
  enrollment_paid: [
    { enrollment_id: "e1", paid: 50_000 },
    { enrollment_id: "e2", paid: 30_000 },
  ],
  session_paid: 66_000,
}

/**
 * RPC simulée : renvoie la réponse fournie et enregistre ses appels (nom +
 * arguments), sans cast de type.
 */
function fakeRpc(response: {
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe("parseFinancialKpis", () => {
  it("normalise la charge utile JSONB (snake_case → camelCase)", () => {
    expect(parseFinancialKpis(PAYLOAD)).toEqual({
      collectedThisYear: 250_000,
      collectedThisMonth: 70_000,
      collectedPreviousMonth: 10_000,
      byMethod: [
        { method: "cash", total: 50_000 },
        { method: "mobile_money", total: 30_000 },
      ],
      daily: [
        { date: "2026-01-14", total: 0 },
        { date: "2026-01-15", total: 40_000 },
      ],
    })
  })

  it("accepte des listes vides (école sans encaissement)", () => {
    expect(
      parseFinancialKpis({
        collected_this_year: 0,
        collected_this_month: 0,
        collected_previous_month: 0,
        by_method: [],
        daily_series: [],
      })
    ).toEqual({
      collectedThisYear: 0,
      collectedThisMonth: 0,
      collectedPreviousMonth: 0,
      byMethod: [],
      daily: [],
    })
  })

  it("refuse une charge utile non conforme plutôt que de deviner", () => {
    expect(parseFinancialKpis(null)).toBeNull()
    expect(parseFinancialKpis([])).toBeNull()
    expect(parseFinancialKpis("json")).toBeNull()
    // totaux manquants ou non numériques
    expect(parseFinancialKpis({ by_method: [], daily_series: [] })).toBeNull()
    expect(
      parseFinancialKpis({ ...PAYLOAD, collected_this_month: "70000" })
    ).toBeNull()
    expect(
      parseFinancialKpis({ ...PAYLOAD, collected_this_year: Number.NaN })
    ).toBeNull()
    // listes malformées
    expect(parseFinancialKpis({ ...PAYLOAD, by_method: null })).toBeNull()
    expect(
      parseFinancialKpis({ ...PAYLOAD, by_method: [{ method: "cash" }] })
    ).toBeNull()
    expect(parseFinancialKpis({ ...PAYLOAD, daily_series: {} })).toBeNull()
    expect(
      parseFinancialKpis({
        ...PAYLOAD,
        daily_series: [{ date: "15/01/2026", total: 1 }],
      })
    ).toBeNull()
  })
})

describe("fetchDirectionFinancialKpis", () => {
  it("appelle la RPC avec l'école, l'année, l'instant et la fenêtre", async () => {
    const { rpc, calls } = fakeRpc({ data: PAYLOAD, error: null })

    await expect(fetchDirectionFinancialKpis(rpc, PARAMS)).resolves.toEqual({
      collectedThisYear: 250_000,
      collectedThisMonth: 70_000,
      collectedPreviousMonth: 10_000,
      byMethod: PAYLOAD.by_method,
      daily: PAYLOAD.daily_series,
    })
    expect(calls).toEqual([
      {
        name: DIRECTION_FINANCIAL_KPIS_RPC,
        args: {
          p_school_id: "school-1",
          p_academic_year_id: "y2",
          p_now: "2026-01-15T10:00:00.000Z",
          p_daily_window: 14,
        },
      },
    ])
  })

  it("renvoie null et journalise l'échec base (repli appelant)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpc({ data: null, error: { message: "boom" } })

    await expect(fetchDirectionFinancialKpis(rpc, PARAMS)).resolves.toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.financial_kpis_rpc_failed"
    )
  })

  it("renvoie null quand la RPC lève (réseau, timeout)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const rpc = (() => Promise.reject(new Error("fetch failed"))) as RpcCall

    await expect(fetchDirectionFinancialKpis(rpc, PARAMS)).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain("fetch failed")
  })

  it("journalise une charge utile invalide sans planter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpc({ data: { collected_this_year: 1 }, error: null })

    await expect(fetchDirectionFinancialKpis(rpc, PARAMS)).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.financial_kpis_rpc_invalid"
    )
  })
})

describe("loadDirectionFinancialKpis", () => {
  it("ne fait aucun appel sans RPC (client dégradé)", async () => {
    await expect(loadDirectionFinancialKpis(null, PARAMS)).resolves.toBeNull()
  })

  it("relaie les KPI validés de la RPC", async () => {
    const { rpc } = fakeRpc({ data: PAYLOAD, error: null })

    await expect(loadDirectionFinancialKpis(rpc, PARAMS)).resolves.toMatchObject(
      { collectedThisYear: 250_000 }
    )
  })
})

describe("parseBalanceKpis", () => {
  it("normalise les soldes par inscription et le total de session", () => {
    expect(parseBalanceKpis(BALANCE_PAYLOAD)).toEqual({
      enrollmentPaid: [
        { enrollmentId: "e1", paid: 50_000 },
        { enrollmentId: "e2", paid: 30_000 },
      ],
      sessionPaid: 66_000,
    })
  })

  it("accepte une école sans encaissement (liste vide, session à 0)", () => {
    expect(parseBalanceKpis({ enrollment_paid: [], session_paid: 0 })).toEqual({
      enrollmentPaid: [],
      sessionPaid: 0,
    })
  })

  it("refuse une charge utile non conforme au lieu de l'accepter au partiel", () => {
    // Total de session absent, liste d'inscriptions absente.
    expect(parseBalanceKpis({ enrollment_paid: [] })).toBeNull()
    expect(parseBalanceKpis({ session_paid: 0 })).toBeNull()
    // Identifiant vide, montant non fini, entrée inattendue.
    expect(
      parseBalanceKpis({
        enrollment_paid: [{ enrollment_id: "", paid: 1 }],
        session_paid: 0,
      })
    ).toBeNull()
    expect(
      parseBalanceKpis({
        enrollment_paid: [{ enrollment_id: "e1", paid: null }],
        session_paid: 0,
      })
    ).toBeNull()
    expect(parseBalanceKpis({ enrollment_paid: [null], session_paid: 0 })).toBeNull()
    // Ce n'est pas un objet.
    expect(parseBalanceKpis([])).toBeNull()
    expect(parseBalanceKpis(null)).toBeNull()
  })
})

describe("fetchDirectionBalanceKpis", () => {
  it("appelle la RPC avec l'école, l'année et la session", async () => {
    const { rpc, calls } = fakeRpc({ data: BALANCE_PAYLOAD, error: null })

    await expect(
      fetchDirectionBalanceKpis(rpc, BALANCE_PARAMS)
    ).resolves.toEqual({
      enrollmentPaid: [
        { enrollmentId: "e1", paid: 50_000 },
        { enrollmentId: "e2", paid: 30_000 },
      ],
      sessionPaid: 66_000,
    })
    expect(calls).toEqual([
      {
        name: DIRECTION_BALANCE_KPIS_RPC,
        args: {
          p_school_id: "school-1",
          p_academic_year_id: "y2",
          p_cash_session_id: "s1",
        },
      },
    ])
  })

  it("renvoie null et journalise l'échec base (repli appelant)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpc({ data: null, error: { message: "boom" } })

    await expect(
      fetchDirectionBalanceKpis(rpc, BALANCE_PARAMS)
    ).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.balance_kpis_rpc_failed"
    )
  })

  it("renvoie null quand la RPC lève (réseau, timeout)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const rpc: RpcCall = () => Promise.reject(new Error("socket hang up"))

    await expect(
      fetchDirectionBalanceKpis(rpc, BALANCE_PARAMS)
    ).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.balance_kpis_rpc_failed"
    )
  })

  it("journalise une charge utile invalide sans planter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rpc } = fakeRpc({ data: { session_paid: 10 }, error: null })

    await expect(
      fetchDirectionBalanceKpis(rpc, BALANCE_PARAMS)
    ).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain(
      "direction.balance_kpis_rpc_invalid"
    )
  })
})

describe("loadDirectionBalanceKpis", () => {
  it("ne fait aucun appel sans RPC (client dégradé)", async () => {
    await expect(
      loadDirectionBalanceKpis(null, BALANCE_PARAMS)
    ).resolves.toBeNull()
  })

  it("relaie les soldes validés de la RPC", async () => {
    const { rpc } = fakeRpc({ data: BALANCE_PAYLOAD, error: null })

    await expect(
      loadDirectionBalanceKpis(rpc, BALANCE_PARAMS)
    ).resolves.toMatchObject({ sessionPaid: 66_000 })
  })
})
