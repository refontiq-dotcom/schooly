import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ControlCenterPushError,
  buildPayload,
  collect,
  describePushFailure,
  hasValidBearer,
  pushControlCenterMetrics,
  readConfig,
  type SupabaseLike,
} from "./control-center-metrics"

const SECRET = "secret-de-test-ne-doit-jamais-apparaitre"
const RUN = "5a0f2c1e-8c53-4b3a-9d55-0d6f4f1b2a10"
const NOW = new Date("2026-10-21T01:00:00.000Z")
type Row = Record<string, unknown>

/** Faux Supabase : applique eq / is / range ET le plafond de 1000 lignes de la vraie API. */
function fakeSupabase(tables: Record<string, Row[]>, failTable?: string): SupabaseLike & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    from(table: string) {
      calls.push(table)
      const filters: Array<(r: Row) => boolean> = []
      let range: [number, number] | null = null
      let head = false
      const b: Record<string, unknown> = {}
      b.select = (_c: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), b)
      b.eq = (col: string, val: unknown) => (filters.push((r) => r[col] === val), b)
      b.is = (col: string, val: unknown) => (filters.push((r) => (r[col] ?? null) === val), b)
      b.order = () => b
      b.range = (a: number, z: number) => ((range = [a, z]), b)
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        if (table === failTable) return Promise.resolve({ data: null, count: null, error: { code: "42P01" } }).then(res, rej)
        const all = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
        if (head) return Promise.resolve({ count: all.length, error: null }).then(res, rej)
        const [a, z] = range ?? [0, 999]
        const page = all.slice(a, Math.min(z, a + 999) + 1) // plafond serveur : 1000 lignes
        return Promise.resolve({ data: page, error: null }).then(res, rej)
      }
      return b
    },
  }
}

const ledger = (n: number, status = "due", tenant = "t1"): Row[] =>
  Array.from({ length: n }, () => ({ product_id: "schooly", amount: 1000, status, tenant_id: tenant }))

const GOOD = (): Record<string, Row[]> => ({
  platform_fee_ledger: ledger(2),
  platform_invoices: [],
  schools: [{ id: 1, deleted_at: null }],
  enrollments: [
    ...Array.from({ length: 150 }, () => ({ status: "pending", deleted_at: null })),
    ...Array.from({ length: 11 }, () => ({ status: "active", deleted_at: null })),
    ...Array.from({ length: 2 }, () => ({ status: "confirmed", deleted_at: null })),
  ],
})

const ok = (body: unknown = { ok: true, status: "stored", schema: "v1", warnings: [] }, status = 200) =>
  new Response(JSON.stringify(body), { status })
const noSleep = async () => {}
const args = (supabase: SupabaseLike, over: Record<string, unknown> = {}) =>
  ({ supabase, baseUrl: "https://cc.example.com", secret: SECRET, now: () => NOW, runId: () => RUN, sleep: noSleep, ...over }) as never

describe("collecte Schooly", () => {
  it("compte les frais depuis le grand livre et les factures, pas depuis un « MRR »", async () => {
    const s = await collect(fakeSupabase(GOOD()))
    expect(s).toMatchObject({ fraisGeneres: 2000, fraisEncaisses: 0, fraisAEncaisser: 2000, inscriptionsFacturables: 2 })
  })

  it("distingue les inscriptions en attente / confirmées / actives (régression : 162 « actives »)", async () => {
    const s = await collect(fakeSupabase(GOOD()))
    expect(s).toMatchObject({ inscriptionsTotal: 163, inscriptionsEnAttente: 150, inscriptionsConfirmees: 2, inscriptionsActives: 11 })
  })

  it("l'argent reçu = factures PAYÉES, même si les lignes du grand livre restent « due »", async () => {
    const t = GOOD()
    t.platform_invoices = [
      { product_id: "schooly", status: "paid", total_due: 2000, paid_amount: 2000, tenant_id: "t1" },
      { product_id: "schooly", status: "overdue", total_due: 5000, paid_amount: null, tenant_id: "t2" },
      { product_id: "schooly", status: "pending", total_due: 3000, paid_amount: null, tenant_id: "t3" },
      { product_id: "autre_produit", status: "paid", total_due: 7777, paid_amount: 7777, tenant_id: "t9" }, // ignorée
    ]
    const s = await collect(fakeSupabase(t))
    expect(s).toMatchObject({ fraisEncaisses: 2000, facturesOuvertesMontant: 8000, facturesEnRetard: 1 })
    expect(s.fraisAEncaisser).toBe(0) // 2000 générés − 2000 encaissés
  })

  it("fraisAEncaisser n'est jamais négatif", async () => {
    const t = GOOD()
    t.platform_invoices = [{ product_id: "schooly", status: "paid", total_due: 9000, paid_amount: 9000, tenant_id: "t1" }]
    expect((await collect(fakeSupabase(t))).fraisAEncaisser).toBe(0)
  })

  it("lit PLUS de 1000 lignes sans troncature (le plafond du serveur est simulé)", async () => {
    const t = GOOD()
    t.platform_fee_ledger = ledger(2500)
    const s = await collect(fakeSupabase(t))
    expect(s.inscriptionsFacturables).toBe(2500)
    expect(s.fraisGeneres).toBe(2_500_000)
  })

  it("exactement 1000 lignes : pas de lecture manquante ni de boucle infinie", async () => {
    const t = GOOD()
    t.platform_fee_ledger = ledger(1000)
    expect((await collect(fakeSupabase(t))).inscriptionsFacturables).toBe(1000)
  })

  it("une table illisible → erreur « collect » qui nomme la table et le code", async () => {
    const err = (await collect(fakeSupabase(GOOD(), "platform_invoices")).catch((e) => e)) as ControlCenterPushError
    expect(err).toMatchObject({ stage: "collect", code: "source_unavailable" })
    expect(err.message).toContain("platform_invoices")
    expect(err.message).toContain("42P01")
  })
})

describe("contrat v1 de Schooly", () => {
  it("n'envoie AUCUN mrr (revenu par inscription, non récurrent) et un contrat complet", async () => {
    const src = await collect(fakeSupabase(GOOD()))
    const p = buildPayload(src, { collectedAt: NOW, runId: RUN, environment: "production" })
    expect("mrr" in p).toBe(false)
    expect(p).toMatchObject({ contract_version: 1, projet: "schooly", run_id: RUN, collected_at: "2026-10-21T01:00:00.000Z", statut_sante: "healthy", comptes_actifs: 1 })
    expect(p.details).toMatchObject({ frais_generes: 2000, frais_encaisses: 0, frais_a_encaisser: 2000, inscriptions_en_attente: 150 })
  })

  it("n'envoie que des agrégats : aucune donnée personnelle dans la charge utile", async () => {
    const t = GOOD()
    t.enrollments = [{ status: "confirmed", deleted_at: null, student_name: "Awa Koné", parent_phone: "0700000000" }]
    const src = await collect(fakeSupabase(t))
    const json = JSON.stringify(buildPayload(src, { collectedAt: NOW, runId: RUN, environment: "production" }))
    expect(json).not.toMatch(/Awa|Koné|0700000000|student|parent/)
  })
})

describe("envoi", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it("succès : 1 tentative, secret en en-tête seulement", async () => {
    const f = vi.fn(async () => ok())
    const r = await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: f }))
    expect(r.attempts).toBe(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://cc.example.com/api/metrics/push")
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${SECRET}`)
    expect(init.body as string).not.toContain(SECRET)
  })

  it("401 : pas de relance, cause visible", async () => {
    const f = vi.fn(async () => ok({ code: "unauthorized" }, 401))
    const err = (await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: f })).catch((e) => e)) as ControlCenterPushError
    expect(f).toHaveBeenCalledTimes(1)
    expect(err).toMatchObject({ stage: "rejected", upstreamStatus: 401, upstreamCode: "unauthorized" })
  })

  it("500 puis 200 : relance avec le MÊME corps (même run_id)", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok({ code: "history_failed" }, 500)).mockResolvedValueOnce(ok())
    const r = await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: f }))
    expect(r.attempts).toBe(2)
    const [b1, b2] = f.mock.calls.map((c) => (c[1] as RequestInit).body)
    expect(b1).toBe(b2)
  })

  it("réseau coupé : 2 tentatives puis network_error (502) ; délai dépassé : timeout (504)", async () => {
    const net = vi.fn(async () => { throw new TypeError("fetch failed") })
    const e1 = (await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: net })).catch((e) => e)) as ControlCenterPushError
    expect(net).toHaveBeenCalledTimes(2)
    expect(describePushFailure(e1).status).toBe(502)
    const slow = vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }) })
    const e2 = (await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: slow })).catch((e) => e)) as ControlCenterPushError
    expect(describePushFailure(e2).status).toBe(504)
  })

  it("aucune réponse d'erreur ne contient le secret", async () => {
    const f = vi.fn(async () => { throw new TypeError(`boom ${SECRET}`) })
    const err = await pushControlCenterMetrics(args(fakeSupabase(GOOD()), { fetchImpl: f })).catch((e) => e)
    expect(JSON.stringify(describePushFailure(err))).not.toContain(SECRET)
  })
})

describe("configuration et authentification", () => {
  const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "CONTROL_CENTER_URL", "METRICS_PUSH_SECRET"] as const
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k]
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.SUPABASE_SECRET_KEY = "k"
    process.env.CONTROL_CENTER_URL = "https://control.refontiq.com/"
    process.env.METRICS_PUSH_SECRET = SECRET
  })
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } })

  it("CONTROL_CENTER_URL manquante est NOMMÉE (le cas réel rencontré en production)", () => {
    delete process.env.CONTROL_CENTER_URL
    const err = (() => { try { readConfig() } catch (e) { return e as ControlCenterPushError } })()
    expect(err).toMatchObject({ stage: "config", code: "configuration_missing", missing: ["CONTROL_CENTER_URL"] })
    expect(describePushFailure(err).status).toBe(503)
  })

  it("plusieurs variables manquantes sont toutes listées, jamais leur valeur", () => {
    delete process.env.CONTROL_CENTER_URL
    delete process.env.METRICS_PUSH_SECRET
    const err = (() => { try { readConfig() } catch (e) { return e as ControlCenterPushError } })()
    expect(err?.missing).toEqual(["CONTROL_CENTER_URL", "METRICS_PUSH_SECRET"])
  })

  it("URL normalisée (sans « / » final) ; http et URL invalide refusés", () => {
    expect(readConfig().baseUrl).toBe("https://control.refontiq.com")
    process.env.CONTROL_CENTER_URL = "http://control.refontiq.com"
    expect(() => readConfig()).toThrow(/https/)
    process.env.CONTROL_CENTER_URL = "pas une url"
    expect(() => readConfig()).toThrow(/URL valide/)
  })

  it("hasValidBearer : secret exact seulement", () => {
    expect(hasValidBearer("Bearer abc", "abc")).toBe(true)
    expect(hasValidBearer("Bearer abd", "abc")).toBe(false)
    expect(hasValidBearer("abc", "abc")).toBe(false)
    expect(hasValidBearer("Bearer ", "")).toBe(false)
    expect(hasValidBearer(null, "abc")).toBe(false)
    expect(hasValidBearer("Bearer undefined", undefined)).toBe(false)
  })
})
