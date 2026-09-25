import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireSchoolRole: vi.fn(),
  getPreEnrollments: vi.fn(),
  getStudents: vi.fn(),
  getGuardians: vi.fn(),
  getEnrollments: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({}) }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createAdminClient }))
vi.mock("@/utils/supabase/require-role", () => ({
  requireSchoolRole: mocks.requireSchoolRole,
  denial: (reason: unknown) => ({ error: `Accès refusé (${String(reason)})` }),
}))
// S2 : le snapshot est composé de getters paginables — on les isole pour
// vérifier que le plafond est bien transmis et que la couverture est honnête.
vi.mock("./pre-enrollments", () => ({ getPreEnrollments: mocks.getPreEnrollments }))
vi.mock("./people", () => ({
  getStudents: mocks.getStudents,
  getGuardians: mocks.getGuardians,
}))
vi.mock("./enrollments", () => ({ getEnrollments: mocks.getEnrollments }))

import { MAX_PAGE_SIZE } from "@/lib/pagination"
import { getDirectorySnapshot, searchDirectory } from "./directory"

const ALLOWED = { ok: true, context: { schoolId: "school-1", userId: "user-1" } }

/** Réponse paginée type d'un getter : `count` lignes rendues sur `total`. */
function pageResult(count: number, total: number) {
  return {
    data: Array.from({ length: count }, (_, index) => ({ id: `row-${index}` })),
    page: 1,
    pageSize: count,
    total,
    totalPages: 1,
  }
}

describe("getDirectorySnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSchoolRole.mockResolvedValue(ALLOWED)
    mocks.getStudents.mockResolvedValue(pageResult(2, 2))
    mocks.getGuardians.mockResolvedValue(pageResult(1, 1))
    mocks.getEnrollments.mockResolvedValue(pageResult(3, 3))
    mocks.getPreEnrollments.mockResolvedValue(pageResult(0, 0))
  })

  it("borne les quatre listes en base au lieu de rapatrier l'école entière", async () => {
    const res = await getDirectorySnapshot()

    expect(mocks.getStudents).toHaveBeenCalledWith("school-1", {
      pageSize: MAX_PAGE_SIZE,
    })
    expect(mocks.getGuardians).toHaveBeenCalledWith("school-1", {
      pageSize: MAX_PAGE_SIZE,
    })
    expect(mocks.getEnrollments).toHaveBeenCalledWith("school-1", {
      pageSize: MAX_PAGE_SIZE,
    })
    expect(mocks.getPreEnrollments).toHaveBeenCalledWith("school-1", {
      pageSize: MAX_PAGE_SIZE,
    })
    expect(res).toMatchObject({ meta: { loaded: 6, total: 6, truncated: false } })
  })

  it("signale une couverture partielle au lieu de la laisser croire exhaustive", async () => {
    mocks.getStudents.mockResolvedValue(pageResult(MAX_PAGE_SIZE, 480))

    const res = await getDirectorySnapshot()

    expect(res).toMatchObject({
      meta: { loaded: MAX_PAGE_SIZE + 4, total: 480 + 4, truncated: true },
    })
  })

  it("plafonne une taille de page demandée trop grande", async () => {
    await getDirectorySnapshot({ pageSize: 10_000 })

    expect(mocks.getStudents).toHaveBeenCalledWith("school-1", {
      pageSize: MAX_PAGE_SIZE,
    })
  })

  it("refus de rôle : aucune lecture et un message d'erreur", async () => {
    mocks.requireSchoolRole.mockResolvedValue({ ok: false, reason: "not_member" })

    const res = await getDirectorySnapshot()

    expect(res).toEqual({ error: "Accès refusé (not_member)" })
    expect(mocks.getStudents).not.toHaveBeenCalled()
    expect(mocks.getEnrollments).not.toHaveBeenCalled()
  })

  it("tolère un getter en échec (liste vide) sans casser le snapshot", async () => {
    mocks.getGuardians.mockResolvedValue({ error: "boom" })

    const res = await getDirectorySnapshot()

    expect(res).toMatchObject({ data: { guardians: [] }, meta: { loaded: 5 } })
  })
})

/* ─────────────────────────── S3 : searchDirectory ─────────────────────────── */

type Row = Record<string, unknown>

/**
 * Client admin simulé : enregistre chaque maillon de la chaîne pour prouver ce
 * qui part réellement en base (filtres, plafonds, périmètre école), et rend les
 * lignes de la table demandée.
 */
function fakeAdminClient(dataByTable: Record<string, Row[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const from = (table: string) => {
    const rows = dataByTable[table] ?? []
    const builder: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "limit", "or", "in", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return builder
      }
    }
    builder.then = (onFulfilled?: (value: { data: Row[] }) => unknown) =>
      Promise.resolve({ data: rows }).then(onFulfilled)
    return builder
  }
  return { client: { from }, calls }
}

const SEARCH_FIXTURES: Record<string, Row[]> = {
  students: [
    {
      id: "s1",
      first_name: "Alice",
      last_name: "Koné",
      enrollments: [{ grade_levels: { name: "6ème" }, classes: { name: "6ème A" } }],
    },
  ],
  guardians: [
    {
      id: "g1",
      full_name: "Bob Traoré",
      phone: "+2250708070808",
      enrollments: [
        { student_id: "s1", students: { first_name: "Alice", last_name: "Koné" } },
      ],
    },
  ],
  enrollments: [
    {
      id: "e1",
      student_id: "s1",
      matricule: "M1",
      status: "active",
      students: { first_name: "Alice", last_name: "Koné" },
      guardians: { full_name: "Bob Traoré", phone: "+2250708070808" },
      grade_levels: { name: "6ème" },
      classes: { name: "6ème A" },
    },
  ],
  pre_enrollments: [
    {
      id: "p1",
      first_name: "Carla",
      last_name: "Diallo",
      code: "ABC123",
      guardian_phone: "+2250102030405",
      grade_levels: { name: "5ème" },
    },
  ],
}

/** Filtres `or` émis pour une table donnée. */
function orFilters(
  calls: Array<{ table: string; method: string; args: unknown[] }>,
  table: string
): string[] {
  return calls
    .filter((call) => call.table === table && call.method === "or")
    .map((call) => String(call.args[0]))
}

describe("searchDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSchoolRole.mockResolvedValue(ALLOWED)
    mocks.createAdminClient.mockReturnValue(fakeAdminClient(SEARCH_FIXTURES).client)
  })

  it("ne touche pas la base sous deux caractères", async () => {
    const { client, calls } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("a")

    expect(res).toEqual({ data: { hits: [], mayHaveMore: false } })
    expect(calls).toHaveLength(0)
  })

  it("filtre chaque table en base et reste borné à l'école", async () => {
    const { client, calls } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    await searchDirectory("kone")

    // Un filtre trigram par token et par colonne, sur les quatre tables.
    expect(orFilters(calls, "students")).toEqual([
      "last_name.ilike.*kone*,first_name.ilike.*kone*",
    ])
    expect(orFilters(calls, "guardians")).toContain("full_name.ilike.*kone*")
    expect(orFilters(calls, "pre_enrollments")).toEqual([
      "first_name.ilike.*kone*,last_name.ilike.*kone*,code.ilike.*kone*",
    ])
    // La table inscriptions reçoit deux `or` : le matricule, puis (dans un
    // second aller-retour) les inscriptions rattachées aux personnes trouvées.
    expect(orFilters(calls, "enrollments")).toContain("matricule.ilike.*kone*")
    expect(orFilters(calls, "enrollments")).toContain(
      "student_id.in.(s1),guardian_id.in.(g1)"
    )

    // Périmètre école sur chaque lecture : pas de fuite inter-établissements.
    // Les tuteurs sont scopés par leur relation inscriptions (même convention que
    // getGuardians), donc le filtre passe par `or` et non par `eq`.
    for (const table of ["students", "pre_enrollments", "enrollments"]) {
      expect(
        calls.some(
          (call) =>
            call.table === table && call.method === "eq" && call.args[0] === "school_id"
        ),
        table
      ).toBe(true)
    }
    expect(orFilters(calls, "guardians")).toContain(
      "enrollments.school_id.eq.school-1"
    )
  })

  it("classe côté serveur et renvoie des hits exploitables", async () => {
    const { client } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("koné")

    expect("data" in res).toBe(true)
    if (!("data" in res)) return
    expect(res.data.hits.map((hit) => hit.kind)).toContain("student")
    expect(res.data.hits[0].title).toContain("Koné")
    // Sous-titre alimenté par l'inscription reliée (matricule · niveau · classe).
    expect(res.data.hits[0].subtitle).toContain("M1")
  })

  it("retrouve un tuteur par son numéro", async () => {
    const { client, calls } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("0708070808")

    expect(orFilters(calls, "guardians")).toContain("phone.ilike.*0708070808*")
    expect("data" in res && res.data.hits.length).toBeGreaterThan(0)
  })

  it("retrouve une inscription par son matricule", async () => {
    const { client } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("M1")

    expect("data" in res && res.data.hits.map((hit) => hit.kind)).toContain("enrollment")
  })

  it("signale qu'un plafond de candidats a été atteint", async () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`,
      first_name: "Alice",
      last_name: "Koné",
      enrollments: [],
    }))
    const { client } = fakeAdminClient({ ...SEARCH_FIXTURES, students: many })
    mocks.createAdminClient.mockReturnValue(client)

    // budget = limitPerKind (5) × 4 = 20 lignes candidates : plafond atteint.
    const res = await searchDirectory("koné")

    expect("data" in res && res.data.mayHaveMore).toBe(true)
  })

  it("ne promet rien quand les candidats sont sous le plafond", async () => {
    const { client } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("koné")

    expect("data" in res && res.data.mayHaveMore).toBe(false)
  })

  it("refus de rôle : aucune lecture", async () => {
    mocks.requireSchoolRole.mockResolvedValue({ ok: false, reason: "not_member" })
    const { client, calls } = fakeAdminClient(SEARCH_FIXTURES)
    mocks.createAdminClient.mockReturnValue(client)

    const res = await searchDirectory("koné")

    expect(res).toEqual({ error: "Accès refusé (not_member)" })
    expect(calls).toHaveLength(0)
  })
})

