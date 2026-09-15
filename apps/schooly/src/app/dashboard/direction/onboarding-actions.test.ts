import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

// ---------------------------------------------------------------------------
// Espions partagés
// ---------------------------------------------------------------------------
// `vi.hoisted` garantit que ces espions existent *avant* l'évaluation des
// factories `vi.mock` (hoistées au-dessus des imports).
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
}))

// Session applicative (client SSR) : seul `auth.getUser` est utilisé.
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

// Client admin (service role) : toutes les requêtes PostgREST passent par `from`.
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))

import { completeOnboardingAction } from "./onboarding-actions"

// ---------------------------------------------------------------------------
// Doublure du client Supabase (chaînable + « awaitable »)
// ---------------------------------------------------------------------------
const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"

type QueryResult = { data?: unknown; error?: unknown }
type WriteOp = { table: string; op: "update" | "insert"; payload: Record<string, unknown> }

/**
 * Reproduit l'API PostgREST utilisée par l'action :
 *   .from(t).select(...).eq(...).eq(...).in(...).limit(1).single()
 *   .from(t).update({...}).eq(...)
 *   .from(t).insert({...})
 * Le builder est « thenable », donc `await` fonctionne à n'importe quel maillon.
 */
type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder
  eq: (...args: unknown[]) => QueryBuilder
  in: (...args: unknown[]) => QueryBuilder
  limit: (...args: unknown[]) => QueryBuilder
  update: (payload: Record<string, unknown>) => QueryBuilder
  insert: (payload: Record<string, unknown>) => QueryBuilder
  single: () => Promise<QueryResult>
  then: <R1 = QueryResult, R2 = never>(
    onFulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ) => Promise<R1 | R2>
}

let roleLookup: QueryResult
let schoolWrite: QueryResult
let yearWrite: QueryResult
let writes: WriteOp[]

function createQueryBuilder(table: string): QueryBuilder {
  const result = (): QueryResult => {
    if (table === "user_school_roles") return roleLookup
    if (table === "schools") return schoolWrite
    if (table === "academic_years") return yearWrite
    return { data: null, error: null }
  }

  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    limit: () => builder,
    update: (payload) => {
      writes.push({ table, op: "update", payload })
      return builder
    },
    insert: (payload) => {
      writes.push({ table, op: "insert", payload })
      return builder
    },
    single: () => Promise.resolve(result()),
    then: (onFulfilled, onRejected) => Promise.resolve(result()).then(onFulfilled, onRejected),
  }

  return builder
}

/** Exécute l'action et intercepte la redirection Next (`NEXT_REDIRECT`). */
async function runAction(fields: Record<string, string> = {}) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) formData.set(key, value)

  try {
    const state = await completeOnboardingAction({ error: null }, formData)
    return { state, redirectedTo: null as string | null }
  } catch (error) {
    const digest = (error as { digest?: string }).digest
    if (!digest?.startsWith("NEXT_REDIRECT")) throw error
    return { state: null, redirectedTo: digest.split(";")[2] ?? null }
  }
}

const VALID_FIELDS = { city: "Abidjan", school_type: "college" }

let consoleError: MockInstance
let consoleWarn: MockInstance

beforeEach(() => {
  vi.clearAllMocks()

  writes = []
  roleLookup = { data: { school_id: SCHOOL_ID }, error: null }
  schoolWrite = { error: null }
  yearWrite = { error: null }

  // L'action journalise les échecs non bloquants : on garde la sortie de test propre.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
  mocks.createAdminClient.mockReturnValue({ from: mocks.from })
  mocks.from.mockImplementation((table: string) => createQueryBuilder(table))
  // Next interrompt le flux de la server action en levant une erreur `NEXT_REDIRECT`.
  mocks.redirect.mockImplementation((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    error.digest = `NEXT_REDIRECT;replace;${url};307;`
    throw error
  })
})

afterEach(() => {
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

// ---------------------------------------------------------------------------
// Garde-fous d'autorisation
// ---------------------------------------------------------------------------
describe("completeOnboardingAction — autorisation", () => {
  it("refuse un visiteur non authentifié et n'écrit rien", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const { state, redirectedTo } = await runAction(VALID_FIELDS)

    expect(state).toEqual({ error: "Non autorisé." })
    expect(redirectedTo).toBeNull()
    expect(writes).toHaveLength(0)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("refuse un compte sans école rattachée", async () => {
    roleLookup = { data: null, error: null }

    const { state, redirectedTo } = await runAction(VALID_FIELDS)

    expect(state).toEqual({ error: "Aucune école rattachée à votre compte." })
    expect(redirectedTo).toBeNull()
    expect(writes).toHaveLength(0)
  })

  it("résout l'école depuis la session (jamais depuis le formulaire)", async () => {
    // Une tentative d'injection d'un school_id arbitraire est ignorée.
    const { redirectedTo } = await runAction({ ...VALID_FIELDS, school_id: "attacker-school" })

    expect(redirectedTo).toBe("/dashboard/direction")
    expect(mocks.from).toHaveBeenCalledWith("user_school_roles")
    // Aucune écriture ne cible une autre école que celle résolue serveur.
    for (const write of writes) {
      expect(write.payload.school_id ?? SCHOOL_ID).toBe(SCHOOL_ID)
    }
  })
})

// ---------------------------------------------------------------------------
// Validation des entrées
// ---------------------------------------------------------------------------
describe("completeOnboardingAction — validation", () => {
  it("rejette un type d'établissement hors enum sans rien écrire", async () => {
    const { state } = await runAction({ city: "Abidjan", school_type: "universite" })

    expect(state).toEqual({ error: "Type d'établissement invalide." })
    expect(writes).toHaveLength(0)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it("rejette un type d'établissement manquant", async () => {
    const { state } = await runAction({ city: "Abidjan" })

    expect(state).toEqual({ error: "Type d'établissement invalide." })
    expect(writes).toHaveLength(0)
  })

  it.each(["primaire", "college", "lycee", "professionnel", "islamique", "superieur"])(
    "accepte le type d'établissement « %s »",
    async (schoolType) => {
      const { redirectedTo } = await runAction({ city: "Abidjan", school_type: schoolType })

      expect(redirectedTo).toBe("/dashboard/direction")
      expect(writes[0]?.payload.school_type).toBe(schoolType)
    }
  )
})

// ---------------------------------------------------------------------------
// Chemin nominal
// ---------------------------------------------------------------------------
describe("completeOnboardingAction — succès", () => {
  it("enregistre la config et marque l'école comme configurée (sans année académique)", async () => {
    const { state, redirectedTo } = await runAction({ city: "  Abidjan  ", school_type: "college" })

    expect(state).toBeNull()
    expect(writes).toEqual([
      {
        table: "schools",
        op: "update",
        payload: { city: "Abidjan", school_type: "college", is_setup_complete: true },
      },
    ])
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/direction")
    expect(redirectedTo).toBe("/dashboard/direction")
  })

  it("met city à null quand la ville est vide", async () => {
    await runAction({ city: "   ", school_type: "college" })

    expect(writes[0]?.payload.city).toBeNull()
  })

  it("crée l'année académique en cours quand elle est fournie", async () => {
    const { redirectedTo } = await runAction({
      city: "Abidjan",
      school_type: "lycee",
      yearLabel: "2026-2027",
      startDate: "2026-09-15",
      endDate: "2027-07-02",
    })

    expect(writes).toContainEqual({
      table: "academic_years",
      op: "insert",
      payload: {
        school_id: SCHOOL_ID,
        label: "2026-2027",
        start_date: "2026-09-15",
        end_date: "2027-07-02",
        status: "en_cours",
      },
    })
    expect(redirectedTo).toBe("/dashboard/direction")
  })

  it("n'insère aucune année si les champs sont incomplets", async () => {
    // endDate manquant → l'année est ignorée, l'onboarding se termine quand même.
    await runAction({
      city: "Abidjan",
      school_type: "lycee",
      yearLabel: "2026-2027",
      startDate: "2026-09-15",
    })

    expect(writes.filter((write) => write.table === "academic_years")).toHaveLength(0)
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/direction")
  })
})

// ---------------------------------------------------------------------------
// Gestion d'erreurs
// ---------------------------------------------------------------------------
describe("completeOnboardingAction — erreurs", () => {
  it("remonte l'erreur et bloque la redirection si la mise à jour de l'école échoue", async () => {
    schoolWrite = { error: { message: "permission denied" } }

    const { state, redirectedTo } = await runAction(VALID_FIELDS)

    expect(state).toEqual({ error: "Erreur configuration école : permission denied" })
    expect(redirectedTo).toBeNull()
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  it("ne bloque pas l'onboarding si la création de l'année échoue", async () => {
    yearWrite = { error: { message: "duplicate key value" } }

    const { state, redirectedTo } = await runAction({
      city: "Abidjan",
      school_type: "college",
      yearLabel: "2026-2027",
      startDate: "2026-09-15",
      endDate: "2027-07-02",
    })

    expect(state).toBeNull()
    expect(redirectedTo).toBe("/dashboard/direction")
    expect(consoleWarn).toHaveBeenCalled()
  })
})
