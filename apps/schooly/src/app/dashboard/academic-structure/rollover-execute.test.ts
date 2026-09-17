import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Espions partagés (vi.hoisted : évalués avant les factories vi.mock)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  alertRolloverCompleted: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}))

vi.mock("@/lib/telegram", () => ({ alertRolloverCompleted: mocks.alertRolloverCompleted }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  activateAcademicYear,
  canRunRollover,
  executeRollover,
  getRolloverPreview,
} from "./rollover-actions"
import { getAcademicYears } from "./actions"

// ---------------------------------------------------------------------------
// Doublure PostgREST : files de réponses par table + capture des écritures
// ---------------------------------------------------------------------------
// `executeRollover` enchaîne PLUSIEURS requêtes sur la même table
// (inscriptions de l'année source, déjà-réinscrits, puis les lots upsertés) :
// un simple résultat par table ne suffit donc pas. Chaque table reçoit ici une
// FILE de réponses, consommées dans l'ordre des `await` de l'action.
// Convention : une file d'UNE seule réponse est réutilisée pour tous les appels
// (utile pour `user_school_roles`, interrogé une fois par garde) ; une file de
// plusieurs réponses est consommée maillon par maillon.
const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"
const OLD_YEAR = "aaaa1111-0000-0000-0000-000000000001"
const NEW_YEAR = "bbbb2222-0000-0000-0000-000000000002"
const LEVEL_6 = "lvl-06"
const LEVEL_7 = "lvl-07"
const CLASS_6A = "cls-6a"
const CLASS_6B = "cls-6b"
const CLASS_6C = "cls-6c"
const CLASS_5A = "cls-5a"
const CLASS_5B = "cls-5b"

/**
 * Une seule classe par niveau : l'affectation est alors forcément univoque.
 * Les tests qui portent sur l'appariement de parallèle fournissent leur propre
 * référentiel via `stubRollover({ classes })`.
 */
const DEFAULT_CLASSES = [
  { id: CLASS_6A, name: "6ème A", grade_level_id: LEVEL_6 },
  { id: CLASS_5A, name: "5ème A", grade_level_id: LEVEL_7 },
]

type QueryResult = { data?: unknown; error?: unknown }
type Filter = { table: string; method: string; args: unknown[] }
type Write = { table: string; op: "insert" | "upsert"; payload: any; options?: any }

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder
  eq: (...args: unknown[]) => QueryBuilder
  in: (...args: unknown[]) => QueryBuilder
  is: (...args: unknown[]) => QueryBuilder
  order: (...args: unknown[]) => QueryBuilder
  limit: (...args: unknown[]) => QueryBuilder
  insert: (payload: any) => QueryBuilder
  upsert: (payload: any, options?: any) => QueryBuilder
  single: () => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
  then: <R1 = QueryResult, R2 = never>(
    onFulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ) => Promise<R1 | R2>
}

let queues: Map<string, QueryResult[]>
let filters: Filter[]
let writes: Write[]

/** Programme les réponses d'une table, dans l'ordre d'appel. */
function stub(table: string, ...results: QueryResult[]) {
  queues.set(table, [...results])
}

function nextResult(table: string): QueryResult {
  const queue = queues.get(table)
  if (!queue || queue.length === 0) {
    throw new Error(`Requête non prévue sur « ${table} » — ajoutez un stub()`)
  }
  return queue.length === 1 ? queue[0] : queue.shift()!
}

function builderFor(table: string): QueryBuilder {
  const track = (method: string, args: unknown[]): QueryBuilder => {
    filters.push({ table, method, args })
    return builder
  }
  const builder: QueryBuilder = {
    select: (...a) => track("select", a),
    eq: (...a) => track("eq", a),
    in: (...a) => track("in", a),
    is: (...a) => track("is", a),
    order: (...a) => track("order", a),
    limit: (...a) => track("limit", a),
    insert: (payload) => {
      writes.push({ table, op: "insert", payload })
      return builder
    },
    upsert: (payload, options) => {
      writes.push({ table, op: "upsert", payload, options })
      return builder
    },
    single: () => Promise.resolve(nextResult(table)),
    maybeSingle: () => Promise.resolve(nextResult(table)),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(nextResult(table)).then(onFulfilled, onRejected),
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  queues = new Map()
  filters = []
  writes = []
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mocks.sessionFrom.mockImplementation((table: string) => builderFor(table))
  mocks.rpc.mockResolvedValue({ data: "en_cours", error: null })
  mocks.createAdminClient.mockImplementation(() => ({
    from: (table: string) => builderFor(table),
    rpc: mocks.rpc,
  }))
  // Session valide par défaut : direction de l'école courante.
  stub("user_school_roles", { data: { school_id: SCHOOL_ID, role_code: "direction" } })
})

// ---------------------------------------------------------------------------
// Jeux de données
// ---------------------------------------------------------------------------
function enrollment(overrides: Record<string, unknown>) {
  const studentId = (overrides.student_id as string) ?? "s0"
  return {
    id: "e0",
    student_id: studentId,
    guardian_id: "g0",
    financial_profile_id: "fp0",
    grade_level_id: LEVEL_6,
    class_id: null as string | null,
    status: "confirmed",
    matricule: `ETAT-${studentId}`,
    academic_decisions: [{ decision: "pending" }],
    ...overrides,
  }
}

function admitted(overrides: Record<string, unknown>) {
  return enrollment({ academic_decisions: [{ decision: "admitted" }], ...overrides })
}

/**
 * Programme un déroulement nominal complet : année de destination, inscriptions
 * de l'année source, élèves déjà réinscrits, référentiel des rangs, école (pour
 * l'alerte) et journal de bascule. `upserts` = réponses d'écriture (1 INSERT).
 */
function stubRollover({
  enrollments,
  alreadyRolled = [],
  upserts = 1,
  newYear = { id: NEW_YEAR, label: "2026-2027", status: "planifiee" },
  classes = DEFAULT_CLASSES,
}: {
  enrollments: unknown[]
  alreadyRolled?: unknown[]
  upserts?: number
  newYear?: unknown
  classes?: unknown[]
}) {
  stub("academic_years", { data: newYear }, { data: { label: "2025-2026" } })
  stub(
    "enrollments",
    { data: enrollments, error: null },
    { data: alreadyRolled, error: null },
    ...Array.from({ length: upserts }, () => ({ error: null }))
  )
  stub("grade_levels", {
    data: [
      { id: LEVEL_6, level: 6 },
      { id: LEVEL_7, level: 7 },
    ],
    error: null,
  })
  stub("classes", { data: classes, error: null })
  stub("schools", { data: { name: "Collège Test" } })
  stub("year_rollover_logs", { error: null })
}

function insertRows(): Array<Record<string, any>> {
  const ins = writes.find((w) => w.table === "enrollments" && w.op === "insert")
  const payload = ins?.payload
  return Array.isArray(payload) ? payload : payload ? [payload] : []
}

function logRow(): Record<string, any> {
  const log = writes.find((w) => w.table === "year_rollover_logs" && w.op === "insert")
  expect(log, "un journal de bascule doit être écrit").toBeDefined()
  return log!.payload
}

// ===========================================================================
// Garde de session
// ===========================================================================

describe("executeRollover — garde de session", () => {
  it("refuse un utilisateur non authentifié", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(executeRollover(OLD_YEAR, NEW_YEAR)).rejects.toThrow("NOT_AUTHENTICATED")
    expect(writes).toHaveLength(0)
  })

  it("refuse un rôle hors direction (secrétariat, professeur…)", async () => {
    stub("user_school_roles", { data: null, error: null })
    await expect(executeRollover(OLD_YEAR, NEW_YEAR)).rejects.toThrow("UNAUTHORIZED")
    expect(writes).toHaveLength(0)
  })
})

describe("canRunRollover — droit d'exécuter la bascule, sans exception", () => {
  it("autorise la direction", async () => {
    expect(await canRunRollover()).toEqual({ allowed: true })
  })

  it("explique le refus au secrétariat au lieu de laisser l'écran vide", async () => {
    stub("user_school_roles", { data: null, error: null })
    expect(await canRunRollover()).toEqual({
      allowed: false,
      error: "Action réservée à la direction.",
    })
  })

  it("explique une session expirée", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await canRunRollover()).toEqual({
      allowed: false,
      error: "Session expirée — reconnectez-vous.",
    })
  })
})

describe("activateAcademicYear — refus lisible", () => {
  it("renvoie une erreur de rôle au lieu de lever une exception", async () => {
    // L'onglet « Années » est visible du secrétariat : l'action ne doit pas
    // rejeter, sinon la page ne peut rien afficher.
    stub("user_school_roles", { data: null, error: null })
    expect(await activateAcademicYear("y1")).toEqual({
      error: "Action réservée à la direction.",
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
  })

  it("refuse une année d'une autre école AVANT le RPC", async () => {
    stub("academic_years", { data: { school_id: "autre-ecole" }, error: null })
    expect(await activateAcademicYear("y-etrangere")).toEqual({
      error: "Année introuvable.",
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("appelle le RPC seulement si l'année appartient à l'école de la session", async () => {
    stub("academic_years", { data: { school_id: SCHOOL_ID }, error: null })
    const res = await activateAcademicYear("y1")
    expect(res).toEqual({ ok: true, status: "en_cours" })
    expect(mocks.rpc).toHaveBeenCalledWith("activate_academic_year", { p_year_id: "y1" })
  })
})

// ===========================================================================
// Cas limites avant toute écriture
// ===========================================================================

describe("executeRollover — cas limites", () => {
  it("refuse une année de destination introuvable (ou d'une autre école)", async () => {
    stub("academic_years", { data: null })
    expect(await executeRollover(OLD_YEAR, NEW_YEAR)).toEqual({
      error: "Nouvelle année introuvable.",
    })
    expect(writes).toHaveLength(0)
  })

  it("refuse une bascule sans aucun élève", async () => {
    stub("academic_years", { data: { id: NEW_YEAR, label: "2026-2027", status: "planifiee" } })
    stub("enrollments", { data: [], error: null })
    expect(await executeRollover(OLD_YEAR, NEW_YEAR)).toEqual({ error: "Aucun élève à basculer." })
    expect(writes).toHaveLength(0)
  })

  it("refuse une destination identique à la source", async () => {
    // Sans cette garde : tout le monde serait ignoré par la protection
    // anti-doublon et un journal « réussi » à 0 élève ferait croire à une
    // bascule effectuée.
    stub("academic_years", { data: { id: OLD_YEAR, label: "2025-2026", status: "en_cours" } })
    expect(await executeRollover(OLD_YEAR, OLD_YEAR)).toEqual({
      error: "L'année source et l'année de destination doivent être différentes.",
    })
    expect(writes).toHaveLength(0)
  })

  it("refuse de réinscrire dans une année clôturée", async () => {
    stub("academic_years", { data: { id: NEW_YEAR, label: "2026-2027", status: "cloturee" } })
    expect(await executeRollover(OLD_YEAR, NEW_YEAR)).toEqual({
      error: "Impossible de réinscrire dans une année clôturée.",
    })
    expect(writes).toHaveLength(0)
  })

  it("remonte l'erreur de lecture des inscriptions", async () => {
    stub("academic_years", { data: { id: NEW_YEAR, label: "2026-2027", status: "planifiee" } })
    stub("enrollments", { data: null, error: { message: "relation does not exist" } })
    expect(await executeRollover(OLD_YEAR, NEW_YEAR)).toEqual({
      error: "relation does not exist",
    })
    expect(writes).toHaveLength(0)
  })
})

// ===========================================================================
// Promotion, redoublement, exclusion
// ===========================================================================

describe("executeRollover — décisions du conseil de classe", () => {
  it("promeut les admis au rang +1, maintient les redoublants, ignore exclus et sans décision", async () => {
    stubRollover({
      enrollments: [
        admitted({
          id: "e1",
          student_id: "s1",
          guardian_id: "g1",
          grade_level_id: LEVEL_6,
          class_id: CLASS_6A,
        }),
        enrollment({
          id: "e2",
          student_id: "s2",
          guardian_id: "g2",
          grade_level_id: LEVEL_6,
          class_id: CLASS_6A,
          academic_decisions: [{ decision: "repeated" }],
        }),
        enrollment({ id: "e3", student_id: "s3", academic_decisions: [{ decision: "excluded" }] }),
        enrollment({ id: "e4", student_id: "s4", academic_decisions: [{ decision: "pending" }] }),
        // Dernier rang de l'école : admis = diplômé, pas de réinscription.
        admitted({ id: "e5", student_id: "s5", grade_level_id: LEVEL_7 }),
      ],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toEqual({
      ok: true,
      summary: { promoted: 2, repeated: 1, excluded: 1, pending: 1, withoutClass: 0, total: 5 },
    })

    const rows = insertRows()
    expect(rows.map((r) => r.student_id).sort()).toEqual(["s1", "s2"])

    expect(rows.find((r) => r.student_id === "s1")).toMatchObject({
      school_id: SCHOOL_ID,
      guardian_id: "g1",
      grade_level_id: LEVEL_7, // 6 → 7
      class_id: CLASS_5A, // classe du niveau de destination
      academic_year_id: NEW_YEAR,
      status: "active",
      financial_profile_id: "fp0",
      matricule: "ETAT-s1",
    })
    expect(rows.find((r) => r.student_id === "s2")).toMatchObject({
      grade_level_id: LEVEL_6, // redoublant : même rang
      class_id: CLASS_6A, // …et même classe
      academic_year_id: NEW_YEAR,
    })
    expect(rows.every((r) => typeof r.enrollment_date === "string")).toBe(true)
  })

  it("ne réinscrit jamais un élève sans décision du conseil", async () => {
    stubRollover({
      enrollments: [enrollment({ id: "e1", student_id: "s1" })],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { promoted: 0, repeated: 0, pending: 1 } })
    expect(writes.some((w) => w.table === "enrollments" && w.op === "insert")).toBe(false)
    expect(logRow()).toMatchObject({ students_pending: 1, status: "completed" })
  })
})

// ===========================================================================
// Idempotence et absence de perte silencieuse
// ===========================================================================

describe("executeRollover — reprise et intégrité des inscriptions", () => {
  it("ignore les élèves déjà réinscrits sur la nouvelle année (reprise après échec)", async () => {
    stubRollover({
      enrollments: [
        admitted({ id: "e1", student_id: "s1", grade_level_id: LEVEL_6 }),
        enrollment({
          id: "e2",
          student_id: "s2",
          academic_decisions: [{ decision: "repeated" }],
        }),
      ],
      alreadyRolled: [{ student_id: "s1" }],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    // s1 était déjà réinscrit : il n'est ni recompté, ni réinséré.
    expect(res).toMatchObject({ ok: true, summary: { promoted: 0, repeated: 1 } })
    expect(insertRows().map((r) => r.student_id)).toEqual(["s2"])
  })

  it("recopie le matricule d'État, sans le régénérer", async () => {
    stubRollover({
      enrollments: Array.from({ length: 12 }, (_, i) =>
        admitted({
          id: `e${i}`,
          student_id: `s${i}`,
          grade_level_id: LEVEL_6,
          matricule: `ETAT-s${i}`,
        })
      ),
    })

    await executeRollover(OLD_YEAR, NEW_YEAR)

    const rows = insertRows()
    expect(rows).toHaveLength(12)
    expect(rows.map((r) => r.matricule)).toEqual(
      Array.from({ length: 12 }, (_, i) => `ETAT-s${i}`)
    )
    expect(rows.every((r) => r.status === "active")).toBe(true)

    const inserts = writes.filter((w) => w.table === "enrollments" && w.op === "insert")
    expect(inserts).toHaveLength(1)
  })

  it("écrit toutes les réinscriptions en un seul INSERT (pas de lots partiels)", async () => {
    stubRollover({
      enrollments: Array.from({ length: 51 }, (_, i) =>
        admitted({ id: `e${i}`, student_id: `s${i}`, grade_level_id: LEVEL_6 })
      ),
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { promoted: 51 } })
    const inserts = writes.filter((w) => w.table === "enrollments" && w.op === "insert")
    expect(inserts).toHaveLength(1)
    expect((inserts[0].payload as unknown[]).length).toBe(51)
  })

  it("remonte une erreur d'insertion au lieu de l'avaler, et journalise l'échec", async () => {
    stub("academic_years", { data: { id: NEW_YEAR, label: "2026-2027", status: "planifiee" } })
    stub(
      "enrollments",
      { data: [admitted({ id: "e1", student_id: "s1", grade_level_id: LEVEL_6 })], error: null },
      { data: [], error: null },
      { error: { message: "duplicate key value violates unique constraint" } }
    )
    stub("grade_levels", {
      data: [
        { id: LEVEL_6, level: 6 },
        { id: LEVEL_7, level: 7 },
      ],
      error: null,
    })
    stub("classes", { data: DEFAULT_CLASSES, error: null })
    stub("year_rollover_logs", { error: null })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ error: expect.stringContaining("Bascule partielle") })
    expect(logRow()).toMatchObject({
      school_id: SCHOOL_ID,
      old_year_id: OLD_YEAR,
      new_year_id: NEW_YEAR,
      initiated_by: USER_ID,
      status: "failed",
    })
    expect(logRow().error_message).toContain("duplicate key")
    // Pas de fausse alerte de succès à la direction.
    expect(mocks.alertRolloverCompleted).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Affectation de classe
// ===========================================================================

describe("executeRollover — affectation de classe", () => {
  it("suit le parallèle quand il est unique (« 6ème A » → « 5ème A »)", async () => {
    stubRollover({
      classes: [
        { id: CLASS_6A, name: "6ème A", grade_level_id: LEVEL_6 },
        { id: CLASS_6B, name: "6ème B", grade_level_id: LEVEL_6 },
        { id: CLASS_5A, name: "5ème A", grade_level_id: LEVEL_7 },
        { id: CLASS_5B, name: "5ème B", grade_level_id: LEVEL_7 },
      ],
      enrollments: [
        admitted({ id: "e1", student_id: "s1", class_id: CLASS_6A, grade_level_id: LEVEL_6 }),
        admitted({ id: "e2", student_id: "s2", class_id: CLASS_6B, grade_level_id: LEVEL_6 }),
      ],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { promoted: 2, withoutClass: 0 } })
    const rows = insertRows()
    expect(rows.find((r) => r.student_id === "s1")?.class_id).toBe(CLASS_5A)
    expect(rows.find((r) => r.student_id === "s2")?.class_id).toBe(CLASS_5B)
  })

  it("réinscrit sans classe et le rapporte quand le parallèle est ambigu", async () => {
    stubRollover({
      classes: [
        { id: CLASS_6C, name: "6ème C", grade_level_id: LEVEL_6 },
        { id: CLASS_5A, name: "5ème A", grade_level_id: LEVEL_7 },
        { id: CLASS_5B, name: "5ème B", grade_level_id: LEVEL_7 },
      ],
      enrollments: [
        admitted({ id: "e1", student_id: "s1", class_id: CLASS_6C, grade_level_id: LEVEL_6 }),
      ],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { promoted: 1, withoutClass: 1 } })
    // L'élève est bien réinscrit (aucune perte), mais sans affectation au hasard.
    expect(insertRows()[0]).toMatchObject({
      student_id: "s1",
      grade_level_id: LEVEL_7,
      class_id: null,
    })
    expect(logRow()).toMatchObject({ students_without_class: 1 })
  })

  it("affecte la classe unique du niveau à un élève qui n'avait pas de classe", async () => {
    stubRollover({
      classes: [
        { id: CLASS_6A, name: "6ème A", grade_level_id: LEVEL_6 },
        { id: CLASS_5A, name: "5ème A", grade_level_id: LEVEL_7 },
      ],
      enrollments: [
        admitted({ id: "e1", student_id: "s1", class_id: null, grade_level_id: LEVEL_6 }),
      ],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { withoutClass: 0 } })
    expect(insertRows()[0].class_id).toBe(CLASS_5A)
  })

  it("conserve la classe exacte d'un redoublant", async () => {
    stubRollover({
      classes: [
        { id: CLASS_6A, name: "6ème A", grade_level_id: LEVEL_6 },
        { id: CLASS_6B, name: "6ème B", grade_level_id: LEVEL_6 },
      ],
      enrollments: [
        enrollment({
          id: "e1",
          student_id: "s1",
          class_id: CLASS_6B,
          grade_level_id: LEVEL_6,
          academic_decisions: [{ decision: "repeated" }],
        }),
      ],
    })

    const res = await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(res).toMatchObject({ ok: true, summary: { repeated: 1, withoutClass: 0 } })
    expect(insertRows()[0].class_id).toBe(CLASS_6B)
  })
})

// ===========================================================================
// Prévisualisation : annoncer la destination AVANT la bascule
// ===========================================================================

describe("getRolloverPreview — annonce la destination avant d'exécuter", () => {
  it("nomme la classe cible et compte les élèves qui seront sans classe", async () => {
    stub("enrollments", {
      data: [
        {
          id: "e1",
          status: "active",
          class_id: CLASS_6A,
          students: { id: "s1", first_name: "Awa", last_name: "Kone" },
          classes: { name: "6ème A" },
          grade_levels: { id: LEVEL_6, name: "6ème", level: 6 },
          academic_decisions: [{ decision: "admitted" }],
        },
        {
          id: "e2",
          status: "active",
          class_id: CLASS_6C,
          students: { id: "s2", first_name: "Moussa", last_name: "Traore" },
          classes: { name: "6ème C" },
          grade_levels: { id: LEVEL_6, name: "6ème", level: 6 },
          academic_decisions: [{ decision: "admitted" }],
        },
      ],
      error: null,
    })
    stub("grade_levels", {
      data: [
        { id: LEVEL_6, level: 6 },
        { id: LEVEL_7, level: 7 },
      ],
      error: null,
    })
    stub("classes", {
      data: [
        { id: CLASS_6A, name: "6ème A", grade_level_id: LEVEL_6 },
        { id: CLASS_6C, name: "6ème C", grade_level_id: LEVEL_6 },
        { id: CLASS_5A, name: "5ème A", grade_level_id: LEVEL_7 },
        { id: CLASS_5B, name: "5ème B", grade_level_id: LEVEL_7 },
      ],
      error: null,
    })

    const res = await getRolloverPreview(OLD_YEAR)

    const data = (res as { data: any }).data
    expect(data.withoutClass).toBe(1)
    expect(data.enrollments[0]).toMatchObject({
      studentName: "Kone Awa",
      targetStatus: "enrolled",
      targetClassName: "5ème A",
    })
    expect(data.enrollments[1]).toMatchObject({
      targetStatus: "enrolled",
      targetClassId: null,
      targetClassName: null,
    })
  })
})

// ===========================================================================
// Journalisation et alerte
// ===========================================================================

describe("executeRollover — journal et alerte", () => {
  it("journalise la bascule réussie et alerte la direction", async () => {
    stubRollover({
      enrollments: [
        admitted({ id: "e1", student_id: "s1", grade_level_id: LEVEL_6 }),
        enrollment({
          id: "e2",
          student_id: "s2",
          academic_decisions: [{ decision: "repeated" }],
        }),
        enrollment({ id: "e3", student_id: "s3", academic_decisions: [{ decision: "excluded" }] }),
      ],
    })

    await executeRollover(OLD_YEAR, NEW_YEAR)

    expect(logRow()).toMatchObject({
      school_id: SCHOOL_ID,
      old_year_id: OLD_YEAR,
      new_year_id: NEW_YEAR,
      initiated_by: USER_ID,
      students_promoted: 1,
      students_repeated: 1,
      students_excluded: 1,
      students_pending: 0,
      students_without_class: 0,
      status: "completed",
      error_message: null,
    })
    expect(logRow().completed_at).toEqual(expect.any(String))
    expect(mocks.alertRolloverCompleted).toHaveBeenCalledWith({
      schoolName: "Collège Test",
      oldYear: "2025-2026",
      newYear: "2026-2027",
      promoted: 1,
      repeated: 1,
      excluded: 1,
    })
  })
})

// ===========================================================================
// Cloisonnement multi-écoles
// ===========================================================================

describe("executeRollover — cloisonnement par école", () => {
  it("borne années et inscriptions à l'école de la session (verrou multi-tenant)", async () => {
    stubRollover({
      enrollments: [admitted({ id: "e1", student_id: "s1", grade_level_id: LEVEL_6 })],
    })

    await executeRollover(OLD_YEAR, NEW_YEAR)

    // Année de destination : lue AVEC school_id (une année d'une autre école
    // est invisible, donc « introuvable »).
    expect(filters).toContainEqual({
      table: "academic_years",
      method: "eq",
      args: ["school_id", SCHOOL_ID],
    })
    // Les deux lectures d'inscriptions sont bornées école + année.
    for (const year of [OLD_YEAR, NEW_YEAR]) {
      expect(filters).toContainEqual({
        table: "enrollments",
        method: "eq",
        args: ["academic_year_id", year],
      })
    }
    expect(filters).toContainEqual({
      table: "enrollments",
      method: "eq",
      args: ["school_id", SCHOOL_ID],
    })
    expect(filters).toContainEqual({
      table: "enrollments",
      method: "in",
      args: ["status", ["confirmed", "active"]],
    })
    // Suppression logique respectée à chaque lecture d'inscriptions.
    expect(
      filters.filter((f) => f.table === "enrollments" && f.method === "is").length
    ).toBeGreaterThanOrEqual(2)
  })
})

// ===========================================================================
// Lectures du référentiel : soft-delete (audit #8)
// ===========================================================================

describe("getAcademicYears — lecture du référentiel", () => {
  it("exclut les années supprimées logiquement", async () => {
    stub("academic_years", { data: [], error: null })

    await getAcademicYears()

    expect(filters).toContainEqual({ table: "academic_years", method: "is", args: ["deleted_at", null] })
  })
})
