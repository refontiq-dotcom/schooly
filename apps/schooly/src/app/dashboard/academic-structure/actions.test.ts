import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Espions partagés (vi.hoisted : évalués avant les factories vi.mock)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createAdminClient }))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import {
  archiveAcademicYear,
  archiveClass,
  archiveClassSubjectAssignment,
  archiveGradeLevel,
  archiveSubject,
  createAcademicYear,
  createClass,
  createClassSubjectAssignment,
  createGradeLevel,
  createSubject,
  updateClassSubjectAssignment,
  updateGradeLevel,
  updateSubject,
} from "./actions"

// ---------------------------------------------------------------------------
// Doublure PostgREST : file de réponses par table + capture des insertions
// ---------------------------------------------------------------------------
const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"

type QueryResult = { data?: unknown; error?: unknown }
type Filter = { table: string; method: string; args: unknown[] }
type Write = { table: string; op: "insert" | "update"; payload: Record<string, unknown> }

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder
  eq: (...args: unknown[]) => QueryBuilder
  neq: (...args: unknown[]) => QueryBuilder
  in: (...args: unknown[]) => QueryBuilder
  is: (...args: unknown[]) => QueryBuilder
  order: (...args: unknown[]) => QueryBuilder
  limit: (...args: unknown[]) => QueryBuilder
  insert: (payload: Record<string, unknown>) => QueryBuilder
  update: (payload: Record<string, unknown>) => QueryBuilder
  single: () => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
  then: <R1 = QueryResult, R2 = never>(
    onFulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ) => Promise<R1 | R2>
}

let queues: Map<string, QueryResult[]>
let writes: Write[]
let filters: Filter[]

/**
 * Programme les réponses d'une table. Une file d'UNE réponse est réutilisée
 * pour tous les appels ; une file de plusieurs réponses est consommée dans
 * l'ordre (les actions enchaînent parfois deux lectures sur `user_school_roles` :
 * la garde de session, puis le contrôle d'appartenance de l'enseignant).
 */
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
    neq: (...a) => track("neq", a),
    in: (...a) => track("in", a),
    is: (...a) => track("is", a),
    order: (...a) => track("order", a),
    limit: (...a) => track("limit", a),
    insert: (payload) => {
      writes.push({ table, op: "insert", payload })
      return builder
    },
    update: (payload) => {
      writes.push({ table, op: "update", payload })
      return builder
    },
    single: () => Promise.resolve(nextResult(table)),
    maybeSingle: () => Promise.resolve(nextResult(table)),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(nextResult(table)).then(onFulfilled, onRejected),
  }
  return builder
}

/** Rôle de la session : direction de l'école courante. */
const DIRECTION = { data: { school_id: SCHOOL_ID, role_code: "direction" } }

beforeEach(() => {
  vi.clearAllMocks()
  queues = new Map()
  writes = []
  filters = []
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mocks.sessionFrom.mockImplementation((table: string) => builderFor(table))
  mocks.createAdminClient.mockImplementation(() => ({
    from: (table: string) => builderFor(table),
  }))
  stub("user_school_roles", DIRECTION)
})

function form(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

// ===========================================================================
// Classes
// ===========================================================================

describe("createClass — validation et cloisonnement", () => {
  it("refuse un niveau d'une autre école", async () => {
    stub("grade_levels", { data: null, error: null })

    const res = await createClass(
      form({ gradeLevelId: "niveau-etranger", name: "6ème A" })
    )

    expect(res).toEqual({ error: "Niveau introuvable dans cet établissement." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un titulaire qui n'appartient pas au personnel de l'école", async () => {
    stub("user_school_roles", DIRECTION, { data: null, error: null })
    stub("grade_levels", { data: { id: "niveau-1" }, error: null })
    stub("classes", { data: null, error: null })

    const res = await createClass(
      form({ gradeLevelId: "niveau-1", name: "6ème A", headTeacherId: "user-etranger" })
    )

    expect(res).toEqual({
      error: "Ce titulaire n'appartient pas au personnel de l'établissement.",
    })
    expect(writes).toHaveLength(0)
  })

  it("refuse une capacité non entière ou négative avant toute lecture", async () => {
    const res = await createClass(
      form({ gradeLevelId: "niveau-1", name: "6ème A", capacity: "-5" })
    )

    expect(res).toEqual({ error: "La capacité doit être un nombre entier positif." })
    // Aucune requête de contrôle : le rejet est purement local.
    expect(queues.get("grade_levels")).toBeUndefined()
    expect(writes).toHaveLength(0)
  })

  it("crée la classe quand le niveau appartient à l'école", async () => {
    stub("grade_levels", { data: { id: "niveau-1" }, error: null })
    stub("classes", { data: null, error: null }, { error: null })

    const res = await createClass(
      form({ gradeLevelId: "niveau-1", name: "6ème A", capacity: "45" })
    )

    expect(res).toEqual({})
    expect(writes).toEqual([
      {
        table: "classes",
        op: "insert",
        payload: expect.objectContaining({
          school_id: SCHOOL_ID,
          grade_level_id: "niveau-1",
          name: "6ème A",
          capacity: 45,
          head_teacher_id: null,
        }),
      },
    ])
  })

  it("refuse un nom de classe déjà utilisé", async () => {
    stub("grade_levels", { data: { id: "niveau-1" }, error: null })
    stub("classes", { data: { id: "classe-existante" }, error: null })

    const res = await createClass(form({ gradeLevelId: "niveau-1", name: "6ème A" }))

    expect(res).toEqual({ error: "Une classe « 6ème A » existe déjà." })
    expect(writes).toHaveLength(0)
  })
})

// ===========================================================================
// Niveaux et matières
// ===========================================================================

describe("createGradeLevel — rang unique et positif", () => {
  it("refuse un rang non entier positif", async () => {
    const res = await createGradeLevel(form({ name: "6ème", level: "0", cycle: "Collège" }))
    expect(res).toEqual({ error: "Nom, rang (entier positif) et cycle sont requis." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un rang déjà utilisé dans l'école", async () => {
    stub("grade_levels", { data: { name: "6ème" }, error: null })

    const res = await createGradeLevel(form({ name: "6ème bis", level: "6", cycle: "Collège" }))

    expect(res).toEqual({ error: "Le rang 6 est déjà utilisé par le niveau « 6ème »." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un nom de niveau déjà utilisé", async () => {
    stub("grade_levels", { data: null, error: null }, { data: { id: "existant" }, error: null })

    const res = await createGradeLevel(form({ name: "6ème", level: "1", cycle: "Collège" }))

    expect(res).toEqual({ error: "Le niveau « 6ème » existe déjà." })
    expect(writes).toHaveLength(0)
  })
})

describe("createSubject — coefficient", () => {
  it.each([["0"], ["-1"], ["abc"]])("refuse le coefficient « %s »", async (coefficient) => {
    const res = await createSubject(form({ name: "Mathématiques", coefficient }))
    expect(res).toEqual({ error: "Le coefficient doit être un nombre strictement positif." })
    expect(writes).toHaveLength(0)
  })

  it("accepte un coefficient positif", async () => {
    stub("subjects", { data: null, error: null }, { error: null })

    const res = await createSubject(
      form({ name: "Mathématiques", code: "MAT", coefficient: "4" })
    )
    expect(res).toEqual({})
    expect(writes[0].payload).toMatchObject({ name: "Mathématiques", coefficient: 4 })
  })

  it("refuse un nom de matière déjà utilisé", async () => {
    stub("subjects", { data: { id: "matiere-1" }, error: null })

    const res = await createSubject(form({ name: "Mathématiques", coefficient: "4" }))

    expect(res).toEqual({ error: "Une matière « Mathématiques » existe déjà." })
    expect(writes).toHaveLength(0)
  })
})

// ===========================================================================
// Matrice classe × matière
// ===========================================================================

describe("createClassSubjectAssignment — validation et cloisonnement", () => {
  it("refuse une classe d'une autre école", async () => {
    stub("classes", { data: null, error: null })

    const res = await createClassSubjectAssignment(
      form({ classId: "classe-etrangere", subjectId: "matiere-1" })
    )

    expect(res).toEqual({ error: "Classe introuvable dans cet établissement." })
    expect(writes).toHaveLength(0)
  })

  it("refuse une matière d'une autre école", async () => {
    stub("classes", { data: { id: "classe-1" }, error: null })
    stub("subjects", { data: null, error: null })

    const res = await createClassSubjectAssignment(
      form({ classId: "classe-1", subjectId: "matiere-etrangere" })
    )

    expect(res).toEqual({ error: "Matière introuvable dans cet établissement." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un professeur qui n'enseigne pas dans l'école", async () => {
    stub("classes", { data: { id: "classe-1" }, error: null })
    stub("subjects", { data: { id: "matiere-1" }, error: null })
    stub("user_school_roles", DIRECTION, { data: null, error: null })

    const res = await createClassSubjectAssignment(
      form({ classId: "classe-1", subjectId: "matiere-1", teacherId: "prof-etranger" })
    )

    expect(res).toEqual({ error: "Ce professeur n'enseigne pas dans cet établissement." })
    expect(writes).toHaveLength(0)
  })

  it("refuse une affectation déjà existante", async () => {
    stub("classes", { data: { id: "classe-1" }, error: null })
    stub("subjects", { data: { id: "matiere-1" }, error: null })
    stub("class_subject_assignments", { data: { id: "affectation-1" }, error: null })

    const res = await createClassSubjectAssignment(
      form({ classId: "classe-1", subjectId: "matiere-1" })
    )

    expect(res).toEqual({ error: "Cette matière est déjà affectée à cette classe." })
    expect(writes).toHaveLength(0)
  })

  it("crée l'affectation quand classe, matière et professeur sont de l'école", async () => {
    stub("classes", { data: { id: "classe-1" }, error: null })
    stub("subjects", { data: { id: "matiere-1" }, error: null })
    stub("user_school_roles", DIRECTION, { data: { user_id: "prof-1" }, error: null })
    stub("class_subject_assignments", { data: null, error: null })

    const res = await createClassSubjectAssignment(
      form({ classId: "classe-1", subjectId: "matiere-1", teacherId: "prof-1", coefficient: "2" })
    )

    expect(res).toEqual({})
    expect(writes).toEqual([
      {
        table: "class_subject_assignments",
        op: "insert",
        payload: expect.objectContaining({
          school_id: SCHOOL_ID,
          class_id: "classe-1",
          subject_id: "matiere-1",
          teacher_id: "prof-1",
          coefficient: 2,
        }),
      },
    ])
  })
})

// ===========================================================================
// Correction : édition d'un élément du référentiel
// ===========================================================================

describe("updateSubject — corriger une matière", () => {
  it("met à jour nom, code et coefficient", async () => {
    stub("subjects", { data: null }, { data: [{ id: "s1" }] })

    const res = await updateSubject(
      form({ id: "s1", name: "Mathématiques", code: "MAT", coefficient: "4" })
    )

    expect(res).toEqual({})
    expect(writes).toEqual([
      {
        table: "subjects",
        op: "update",
        payload: { name: "Mathématiques", code: "MAT", coefficient: 4 },
      },
    ])
  })

  it("exclut la ligne éditée du contrôle d'unicité (elle ne se bloque pas elle-même)", async () => {
    stub("subjects", { data: null }, { data: [{ id: "s1" }] })

    await updateSubject(form({ id: "s1", name: "Mathématiques", coefficient: "2" }))

    expect(filters).toContainEqual({ table: "subjects", method: "neq", args: ["id", "s1"] })
  })

  it("refuse un nom déjà pris par une autre matière", async () => {
    stub("subjects", { data: { id: "autre" } })

    expect(
      await updateSubject(form({ id: "s1", name: "Histoire", coefficient: "2" }))
    ).toEqual({ error: "Une matière « Histoire » existe déjà." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un coefficient invalide", async () => {
    expect(
      await updateSubject(form({ id: "s1", name: "Maths", coefficient: "0" }))
    ).toEqual({ error: "Le coefficient doit être un nombre strictement positif." })
    expect(writes).toHaveLength(0)
  })
})

// ===========================================================================
// Archivage (suppression logique) : jamais de perte de données
// ===========================================================================

describe("archiveSubject — retirer une matière", () => {
  it("refuse si la matière est encore enseignée dans une classe", async () => {
    stub("class_subject_assignments", { data: { id: "a1" } })

    expect(await archiveSubject("s1")).toEqual({
      error:
        "Cette matière est encore affectée à une ou plusieurs classes : retirez d'abord ces affectations dans la matrice.",
    })
    expect(writes).toHaveLength(0)
  })

  it("archive logiquement, borné à l'école de la session", async () => {
    stub("class_subject_assignments", { data: null })
    stub("subjects", { data: [{ id: "s1" }] })

    expect(await archiveSubject("s1")).toEqual({})

    expect(writes[0]).toMatchObject({ table: "subjects", op: "update" })
    expect(writes[0].payload.deleted_at).toEqual(expect.any(String))
    expect(filters).toContainEqual({
      table: "subjects",
      method: "eq",
      args: ["school_id", SCHOOL_ID],
    })
  })

  it("signale une matière déjà archivée (aucune ligne touchée)", async () => {
    stub("class_subject_assignments", { data: null })
    stub("subjects", { data: [] })

    expect(await archiveSubject("s1")).toEqual({
      error: "Matière introuvable (déjà archivée ?).",
    })
  })
})

describe("archiveClass — retirer une classe", () => {
  it("refuse si des matières y sont encore affectées", async () => {
    stub("class_subject_assignments", { data: { id: "a1" } })

    expect(await archiveClass("c1")).toEqual({
      error:
        "Cette classe a encore des matières affectées : retirez d'abord ces lignes de la matrice.",
    })
    expect(writes).toHaveLength(0)
  })

  it("refuse si des élèves y sont inscrits pour l'année en cours", async () => {
    stub("class_subject_assignments", { data: null })
    stub("academic_years", { data: { id: "y1" } })
    stub("enrollments", { data: { id: "e1" } })

    expect(await archiveClass("c1")).toEqual({
      error: "Des élèves sont inscrits dans cette classe pour l'année en cours : déplacez-les d'abord.",
    })
    expect(writes).toHaveLength(0)
  })

  it("archive une classe libre (les inscriptions des années passées ne bloquent pas)", async () => {
    stub("class_subject_assignments", { data: null })
    stub("academic_years", { data: null }) // aucune année active → pas d'effectif à vérifier
    stub("classes", { data: [{ id: "c1" }] })

    expect(await archiveClass("c1")).toEqual({})
    expect(writes[0]).toMatchObject({ table: "classes", op: "update" })
    expect(writes[0].payload.deleted_at).toEqual(expect.any(String))
  })
})

describe("archiveGradeLevel — retirer un niveau", () => {
  it("refuse si le niveau contient encore des classes", async () => {
    stub("classes", { data: { id: "c1" } })

    expect(await archiveGradeLevel("l1")).toEqual({
      error: "Ce niveau contient encore des classes : archivez-les d'abord.",
    })
    expect(writes).toHaveLength(0)
  })

  it("archive un niveau vide", async () => {
    stub("classes", { data: null })
    stub("grade_levels", { data: [{ id: "l1" }] })

    expect(await archiveGradeLevel("l1")).toEqual({})
    expect(writes[0]).toMatchObject({ table: "grade_levels", op: "update" })
  })
})

describe("createAcademicYear — première année activée", () => {
  it("active d'emblée la première année de l'école", async () => {
    stub("academic_years", { data: null }, { data: null }, { error: null })

    const res = await createAcademicYear(
      form({ label: "2025-2026", startDate: "2025-09-01", endDate: "2026-07-15" })
    )

    expect(res).toEqual({})
    expect(writes).toEqual([
      {
        table: "academic_years",
        op: "insert",
        payload: expect.objectContaining({
          school_id: SCHOOL_ID,
          label: "2025-2026",
          status: "en_cours",
        }),
      },
    ])
  })

  it("laisse « planifiée » une année créée alors qu'une autre est déjà en cours", async () => {
    stub("academic_years", { data: null }, { data: { id: "y-active" } }, { error: null })

    const res = await createAcademicYear(
      form({ label: "2026-2027", startDate: "2026-09-01", endDate: "2027-07-15" })
    )

    expect(res).toEqual({})
    expect(writes[0]).toMatchObject({
      table: "academic_years",
      op: "insert",
      payload: { label: "2026-2027", status: "planifiee" },
    })
  })

  it("refuse un libellé déjà utilisé", async () => {
    stub("academic_years", { data: { id: "y1" } })

    const res = await createAcademicYear(
      form({ label: "2025-2026", startDate: "2025-09-01", endDate: "2026-07-15" })
    )

    expect(res).toEqual({ error: "L'année « 2025-2026 » existe déjà." })
    expect(writes).toHaveLength(0)
  })
})

describe("archiveAcademicYear — retirer une année", () => {
  it("refuse d'archiver l'année en cours", async () => {
    stub("academic_years", { data: { id: "y1", status: "en_cours" } })

    expect(await archiveAcademicYear("y1")).toEqual({
      error: "L'année en cours ne peut pas être archivée : activez d'abord une autre année.",
    })
    expect(writes).toHaveLength(0)
  })

  it("refuse une année qui porte des inscriptions", async () => {
    stub("academic_years", { data: { id: "y1", status: "cloturee" } })
    stub("enrollments", { data: { id: "e1" } })

    expect(await archiveAcademicYear("y1")).toEqual({
      error:
        "Cette année compte des inscriptions : elle ne peut pas être archivée (elle porte l'historique des élèves).",
    })
    expect(writes).toHaveLength(0)
  })

  it("archive une année vide et non active", async () => {
    stub("academic_years", { data: { id: "y1", status: "planifiee" } }, { data: [{ id: "y1" }] })
    stub("enrollments", { data: null })

    expect(await archiveAcademicYear("y1")).toEqual({})
    expect(writes[0]).toMatchObject({ table: "academic_years", op: "update" })
  })
})

describe("updateGradeLevel — corriger un niveau", () => {
  it("refuse un rang déjà utilisé", async () => {
    stub("grade_levels", { data: { name: "6ème" } })

    expect(
      await updateGradeLevel(form({ id: "l1", name: "6ème A", level: "6", cycle: "Collège" }))
    ).toEqual({ error: "Le rang 6 est déjà utilisé par le niveau « 6ème »." })
    expect(writes).toHaveLength(0)
  })

  it("refuse de déplacer le rang d'un niveau où des élèves sont inscrits", async () => {
    stub("grade_levels", { data: null }, { data: { level: 6 } })
    stub("enrollments", { data: { id: "e1" } })

    expect(
      await updateGradeLevel(form({ id: "l1", name: "6ème", level: "7", cycle: "Collège" }))
    ).toEqual({
      error:
        "Des élèves sont inscrits à ce niveau : son rang ne peut plus être modifié (il détermine la promotion).",
    })
    expect(writes).toHaveLength(0)
  })

  it("corrige le nom et le cycle à rang constant", async () => {
    stub("grade_levels", { data: null }, { data: { level: 6 } }, { data: [{ id: "l1" }] })

    expect(
      await updateGradeLevel(form({ id: "l1", name: "6e", level: "6", cycle: "Collège" }))
    ).toEqual({})
    expect(writes).toEqual([
      { table: "grade_levels", op: "update", payload: { name: "6e", level: 6, cycle: "Collège" } },
    ])
  })
})

describe("updateClassSubjectAssignment — coefficient et professeur", () => {
  it("refuse un professeur extérieur à l'école", async () => {
    stub("user_school_roles", DIRECTION, { data: null })

    expect(
      await updateClassSubjectAssignment(
        form({ id: "a1", teacherId: "prof-etranger", coefficient: "2" })
      )
    ).toEqual({ error: "Ce professeur n'enseigne pas dans cet établissement." })
    expect(writes).toHaveLength(0)
  })

  it("met à jour le coefficient et le professeur", async () => {
    stub("user_school_roles", DIRECTION, { data: { user_id: "p1" } })
    stub("class_subject_assignments", { data: [{ id: "a1" }] })

    expect(
      await updateClassSubjectAssignment(form({ id: "a1", teacherId: "p1", coefficient: "3" }))
    ).toEqual({})
    expect(writes).toEqual([
      {
        table: "class_subject_assignments",
        op: "update",
        payload: { teacher_id: "p1", coefficient: 3 },
      },
    ])
  })
})

describe("archiveClassSubjectAssignment — retirer une affectation de la matrice", () => {
  it("archive logiquement l'affectation", async () => {
    stub("class_subject_assignments", { data: [{ id: "a1" }] })

    expect(await archiveClassSubjectAssignment("a1")).toEqual({})
    expect(writes[0].payload.deleted_at).toEqual(expect.any(String))
  })
})

// ===========================================================================
// Garde des actions de correction
// ===========================================================================

describe("writeContext — qui peut corriger / archiver", () => {
  it("refuse un rôle hors structure (professeur, caisse…)", async () => {
    stub("user_school_roles", { data: { school_id: SCHOOL_ID, role_code: "professeur" } })

    expect(await archiveSubject("s1")).toEqual({ error: "Action réservée à un rôle supérieur." })
    expect(writes).toHaveLength(0)
  })

  it("refuse un utilisateur sans école rattachée", async () => {
    stub("user_school_roles", { data: null })

    expect(await archiveAcademicYear("y1")).toEqual({ error: "Aucune école rattachée" })
    expect(writes).toHaveLength(0)
  })
})
