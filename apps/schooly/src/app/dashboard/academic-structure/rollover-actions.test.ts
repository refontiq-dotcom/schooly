import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Espions partagés (vi.hoisted : évalués avant les factories vi.mock)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  alertRolloverCompleted: vi.fn(),
}))

// Client SSR : `getContext()` lit auth + user_school_roles via la SESSION.
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

// Client admin (service role) : enrollments / academic_decisions.
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}))

vi.mock("@/lib/telegram", () => ({ alertRolloverCompleted: mocks.alertRolloverCompleted }))

import { setEnrollmentDecision } from "./rollover-actions"

// ---------------------------------------------------------------------------
// Doublure PostgREST chaînable + thenable, avec CAPTURE DES FILTRES
// ---------------------------------------------------------------------------
const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"

type QueryResult = { data?: unknown; error?: unknown }
type Filter = { table: string; method: string; args: unknown[] }
type WriteOp = { table: string; op: string; payload: Record<string, unknown> }

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder
  eq: (...args: unknown[]) => QueryBuilder
  in: (...args: unknown[]) => QueryBuilder
  is: (...args: unknown[]) => QueryBuilder
  limit: (...args: unknown[]) => QueryBuilder
  upsert: (payload: Record<string, unknown>) => QueryBuilder
  single: () => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
  then: <R1 = QueryResult, R2 = never>(
    onFulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ) => Promise<R1 | R2>
}

let roleLookup: QueryResult
let enrollmentLookup: QueryResult
let filters: Filter[]
let writes: WriteOp[]

function builderFor(table: string): QueryBuilder {
  const result = (): QueryResult => {
    if (table === "user_school_roles") return roleLookup
    if (table === "enrollments") return enrollmentLookup
    return { data: null, error: null }
  }
  const track = (method: string, args: unknown[]): QueryBuilder => {
    filters.push({ table, method, args })
    return builder
  }
  const builder: QueryBuilder = {
    select: (...a) => track("select", a),
    eq: (...a) => track("eq", a),
    in: (...a) => track("in", a),
    is: (...a) => track("is", a),
    limit: (...a) => track("limit", a),
    upsert: (payload) => {
      writes.push({ table, op: "upsert", payload })
      return builder
    },
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result()).then(onFulfilled, onRejected),
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  filters = []
  writes = []
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mocks.sessionFrom.mockImplementation((table: string) => builderFor(table))
  mocks.createAdminClient.mockImplementation(() => ({
    from: (table: string) => builderFor(table),
  }))
  // Session valide par défaut : rôle direction de l'école courante.
  roleLookup = { data: { school_id: SCHOOL_ID, role_code: "direction" } }
  enrollmentLookup = { data: null, error: null }
})

describe("setEnrollmentDecision — garde de session (getContext)", () => {
  it("refuse un utilisateur non authentifié", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(setEnrollmentDecision("e1", "y1", "admitted")).rejects.toThrow(
      "NOT_AUTHENTICATED"
    )
    expect(writes).toHaveLength(0)
  })

  it("refuse un rôle hors liste blanche (professeur, caisse…)", async () => {
    roleLookup = { data: null, error: null }
    await expect(setEnrollmentDecision("e1", "y1", "admitted")).rejects.toThrow(
      "UNAUTHORIZED"
    )
    expect(writes).toHaveLength(0)
  })
})

describe("setEnrollmentDecision — cloisonnement inter-écoles (verrou audit P1-3)", () => {
  it("filtre la recherche d'inscription par l'école de la session", async () => {
    // Le guard de l'audit : l'inscription doit être cherchée AVEC school_id.
    enrollmentLookup = { data: { id: "enr-1", academic_year_id: "y1" }, error: null }
    await setEnrollmentDecision("enr-1", "y1", "admitted")
    expect(filters).toContainEqual({
      table: "enrollments",
      method: "eq",
      args: ["school_id", SCHOOL_ID],
    })
  })

  it("ne révèle pas et n'écrit pas sur une inscription d'une autre école", async () => {
    // Une inscription d'une autre école est invisible (filtre school_id) :
    // la réponse ne doit ni diverger, ni déclencher un upsert.
    enrollmentLookup = { data: null, error: null }
    const res = await setEnrollmentDecision("enr-etranger", "y1", "admitted")
    expect(res).toEqual({ error: "Inscription introuvable." })
    expect(writes).toHaveLength(0)
  })
})

describe("setEnrollmentDecision — validation et écriture", () => {
  it.each([["admitted"], ["repeated"], ["excluded"], ["pending"]] as const)(
    "accepte la décision valide %s et la borne à l'école de la session",
    async (decision) => {
      enrollmentLookup = { data: { id: "enr-1", academic_year_id: "y1" }, error: null }
      const res = await setEnrollmentDecision("enr-1", "y1", decision)
      expect(res).toEqual({ ok: true })
      expect(writes).toEqual([
        {
          table: "academic_decisions",
          op: "upsert",
          payload: expect.objectContaining({
            school_id: SCHOOL_ID,
            enrollment_id: "enr-1",
            decision,
            decided_by: USER_ID,
          }),
        },
      ])
    }
  )

  it("refuse une décision hors enum sans interroger la base", async () => {
    const res = await setEnrollmentDecision("enr-1", "y1", "renvoye" as never)
    expect(res).toEqual({ error: "Décision invalide." })
    // getContext() a déjà lu le rôle (inévitable), mais AUCUNE recherche
    // d'inscription ni écriture ne doit avoir eu lieu.
    expect(filters.filter((f) => f.table === "enrollments")).toHaveLength(0)
    expect(writes).toHaveLength(0)
  })
})

describe("setEnrollmentDecision — année de la décision (verrou d'intégrité)", () => {
  it("rattache la décision à l'année de l'inscription, pas à celle du formulaire", async () => {
    // `oldYearId` vient du client : une décision posée sur une autre année
    // serait quand même lue par la bascule (embed de l'inscription) et
    // appliquée à l'élève. L'écriture doit être refusée.
    enrollmentLookup = { data: { id: "enr-1", academic_year_id: "annee-reelle" }, error: null }
    const res = await setEnrollmentDecision("enr-1", "annee-du-formulaire", "admitted")
    expect(res).toEqual({ error: "Cette inscription n'appartient pas à l'année sélectionnée." })
    expect(writes).toHaveLength(0)
  })
})