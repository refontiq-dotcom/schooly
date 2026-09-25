import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  alertEnrollmentConfirmed: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  // P1-B : purges de tag et cache de lectures — no-op en test unitaire.
  updateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}))
vi.mock("@/lib/telegram", () => ({
  alertEnrollmentConfirmed: mocks.alertEnrollmentConfirmed,
}))

import { completeCounterEnrollment, createPreEnrollment, validatePreEnrollment } from "./actions"

const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"
// P1-A : les ids portés par le FormData doivent être des UUID valides
// (contrat zod) — les valeurs mockées sont des UUID factices.
const PRE_ID = "b2c9e0a1-3f4d-4c5b-8a9e-1d2f3a4b5c6d"
const YEAR_ID = "year-1" // résolu en SQL, jamais porté par le FormData
const GRADE_ID = "c3d0f1b2-4a5e-4d6c-9b0f-2e3f4a5b6c7d"

type QueryResult = { data?: unknown; error?: unknown }
type Write = { table: string; op: "insert" | "update"; payload: Record<string, unknown> }
type Filter = { table: string; method: string; args: unknown[] }

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

function stub(table: string, ...results: QueryResult[]) {
  queues.set(table, [...results])
}

function nextResult(table: string): QueryResult {
  const queue = queues.get(table)
  if (!queue || queue.length === 0) {
    throw new Error(`Requete non prevue sur « ${table} » — ajoutez un stub()`)
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
    rpc: mocks.rpc,
  }))
  // P0-2 : l'encaissement passe par la RPC record_payment (atomique).
  mocks.rpc.mockResolvedValue({
    data: {
      payment_id: "pay-1",
      receipt_number: "R-TEST-0001",
      verification_code: "CODE0001",
      balance_after: 0,
    },
    error: null,
  })
  mocks.alertEnrollmentConfirmed.mockResolvedValue(undefined)
  stub("user_school_roles", DIRECTION)
})

function form(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

describe("createPreEnrollment", () => {
  it("refuse un etablissement inconnu", async () => {
    stub("schools", { data: null })
    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianRelation: "Mère",
        emergencyContactName: "Ibrahim Kone",
        emergencyContactPhone: "+2250600000000",
        enrollmentType: "nouvelle",
        stateOrientation: "non_oriente",
      })
    )
    expect(res).toEqual({ error: "Établissement introuvable." })
    expect(writes).toHaveLength(0)
  })

  it("exige le type d'inscription et l'orientation", async () => {
    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianRelation: "Mère",
        emergencyContactName: "Ibrahim Kone",
        emergencyContactPhone: "+2250600000000",
      })
    )
    expect(res.error).toBe("Le type d'inscription est requis.")
    expect(writes).toHaveLength(0)
  })

  it("exige la derniere classe avec l'ecole precedente", async () => {
    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianRelation: "Mère",
        emergencyContactName: "Ibrahim Kone",
        emergencyContactPhone: "+2250600000000",
        enrollmentType: "nouvelle",
        stateOrientation: "non_oriente",
        previousSchool: "EPP Bingerville 1",
        previousClass: "",
      })
    )
    expect(res.error).toBe("L'école précédente et la dernière classe fréquentée vont ensemble.")
    expect(writes).toHaveLength(0)
  })

  it("exige le lien avec l'eleve", async () => {
    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianRelation: "",
        emergencyContactName: "Ibrahim Kone",
        emergencyContactPhone: "+2250600000000",
        enrollmentType: "nouvelle",
        stateOrientation: "non_oriente",
      })
    )
    expect(res.error).toBe("Le lien avec l'élève est requis.")
    expect(writes).toHaveLength(0)
  })

  it("exige un contact d'urgence complet", async () => {
    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianRelation: "Mère",
        emergencyContactName: "",
        emergencyContactPhone: "",
        enrollmentType: "nouvelle",
        stateOrientation: "non_oriente",
      })
    )
    expect(res.error).toBe("Le contact d'urgence est requis.")
    expect(writes).toHaveLength(0)
  })

  it("persiste tuteur, pieces et moyen de paiement", async () => {
    stub("schools", { data: { id: SCHOOL_ID } })
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("pre_enrollments", { data: null }, { data: { id: "ok" }, error: null })
    stub("school_payment_methods", { data: { id: "pm-1", type: "especes" } })

    const res = await createPreEnrollment(
      form({
        schoolId: SCHOOL_ID,
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianName: "Mariam Kone",
        guardianRelation: "Mère",
        emergencyContactName: "Ibrahim Kone",
        emergencyContactPhone: "+2250600000000",
        previousSchool: "EPP Bingerville 1",
        previousClass: "CM2",
        enrollmentType: "nouvelle",
        stateOrientation: "oriente_etat",
        orientationNumber: "DECO-2026-123",
        birthCertificateNumber: "ACTE-1",
        paymentMethodId: "d4e1a2b3-c5d6-4e7f-8a9b-3c4d5e6f7a8b",
        acceptedChecklist: '["c1"]',
        providedDocuments: '["d1"]',
      })
    )

    expect(res.error).toBeUndefined()
    expect(res.data?.code).toMatch(/^[A-Z2-9]{6}$/)
    const insert = writes.find((w) => w.table === "pre_enrollments" && w.op === "insert")
    expect(insert?.payload).toMatchObject({
      guardian_name: "Mariam Kone",
      guardian_relation: "Mère",
      emergency_contact_name: "Ibrahim Kone",
      emergency_contact_phone: "+2250600000000",
      previous_school: "EPP Bingerville 1",
      previous_class: "CM2",
      enrollment_type: "nouvelle",
      state_orientation: "oriente_etat",
      orientation_number: "DECO-2026-123",
      birth_certificate_number: "ACTE-1",
      payment_method: "cash",
      accepted_checklist: ["c1"],
      provided_documents: ["d1"],
    })
  })
})

describe("validatePreEnrollment", () => {
  const pending = {
    id: PRE_ID,
    school_id: SCHOOL_ID,
    first_name: "Awa",
    last_name: "Kone",
    date_of_birth: "2012-01-01",
    grade_level_id: GRADE_ID,
    guardian_phone: "+2250700000000",
    guardian_name: "Mariam Kone",
    birth_certificate_number: "ACTE-1",
    payment_method: "cash",
    payment_reference: null,
    status: "pending",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }

  it("refuse un encaissement sans montant", async () => {
    stub("pre_enrollments", { data: pending })
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })

    const res = await validatePreEnrollment(
      form({
        preEnrollmentId: PRE_ID,
        collectPayment: "1",
        paymentMethod: "cash",
        amount: "0",
      })
    )
    expect(res.error).toMatch(/montant/)
    expect(writes.filter((w) => w.op === "insert")).toHaveLength(0)
  })

  it("reinscrit l'eleve existant via son matricule sans creer de doublon", async () => {
    stub(
      "pre_enrollments",
      {
        data: {
          ...pending,
          enrollment_type: "reinscription",
          previous_matricule: "61CC-2026-0001",
        },
      },
      { data: { id: PRE_ID } }
    )
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    // 1re requete sur enrollments : le lookup du matricule ; 2e : l'insert de l'annee.
    stub(
      "enrollments",
      { data: { student_id: "stu-old", matricule: "61CC-2026-0001" } },
      { data: { id: "enr-1" }, error: null }
    )
    stub("guardians", { data: { id: "g1" } })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("schools", { data: { name: "Ecole Test" } })

    const res = await validatePreEnrollment(
      form({
        preEnrollmentId: PRE_ID,
        collectPayment: "0",
      })
    )

    expect(res.error).toBeUndefined()
    // Aucune nouvelle fiche eleve : l'ancienne est reutilisee.
    expect(writes.some((w) => w.table === "students" && w.op === "insert")).toBe(false)
    const enrollmentInsert = writes.find((w) => w.table === "enrollments" && w.op === "insert")
    expect(enrollmentInsert?.payload).toMatchObject({
      student_id: "stu-old",
      matricule: "61CC-2026-0001",
      enrollment_type: "reinscription",
    })
  })

  it("cree une nouvelle fiche si le matricule de reinscription est inconnu", async () => {
    stub(
      "pre_enrollments",
      {
        data: {
          ...pending,
          enrollment_type: "reinscription",
          previous_matricule: "INCONNU-1",
        },
      },
      { data: { id: PRE_ID } }
    )
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    stub("enrollments", { data: null }, { data: { id: "enr-1" }, error: null })
    stub("students", { data: { id: "stu" }, error: null })
    stub("guardians", { data: { id: "g1" } })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("schools", { data: { name: "Ecole Test" } })

    const res = await validatePreEnrollment(
      form({
        preEnrollmentId: PRE_ID,
        collectPayment: "0",
      })
    )

    expect(res.error).toBeUndefined()
    expect(writes.some((w) => w.table === "students" && w.op === "insert")).toBe(true)
  })

  it("transporte lien et urgence vers la fiche tuteur", async () => {
    stub(
      "pre_enrollments",
      {
        data: {
          ...pending,
          guardian_relation: "Père",
          emergency_contact_name: "Moussa Kone",
          emergency_contact_phone: "+2250500000000",
          previous_school: "EPP Bingerville 1",
          previous_class: "CM2",
          enrollment_type: "nouvelle",
          state_orientation: "oriente_etat",
          orientation_number: "DECO-2026-123",
        },
      },
      { data: { id: PRE_ID } }
    )
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    stub("students", { data: { id: "stu" }, error: null })
    stub("guardians", { data: { id: "g1" } }, { data: null, error: null })
    stub("enrollments", { data: { id: "enr-1" }, error: null })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("schools", { data: { name: "Ecole Test" } })

    const res = await validatePreEnrollment(
      form({
        preEnrollmentId: PRE_ID,
        collectPayment: "0",
      })
    )

    expect(res.error).toBeUndefined()
    const guardianUpdate = writes.find((w) => w.table === "guardians" && w.op === "update")
    expect(guardianUpdate?.payload).toMatchObject({
      relation: "Père",
      emergency_contact_name: "Moussa Kone",
      emergency_contact_phone: "+2250500000000",
    })
    const studentInsert = writes.find((w) => w.table === "students" && w.op === "insert")
    expect(studentInsert?.payload).toMatchObject({
      previous_school: "EPP Bingerville 1",
      previous_class: "CM2",
    })
    const enrollmentInsert = writes.find((w) => w.table === "enrollments" && w.op === "insert")
    expect(enrollmentInsert?.payload).toMatchObject({
      enrollment_type: "nouvelle",
      state_orientation: "oriente_etat",
      orientation_number: "DECO-2026-123",
    })
  })

  it("cree eleve, inscription, paiement et recu", async () => {
    stub("pre_enrollments", { data: pending }, { data: { id: PRE_ID } })
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    stub("students", { data: { id: "stu" }, error: null })
    stub("guardians", { data: { id: "g1" } })
    stub("enrollments", { data: { id: "enr-1" }, error: null })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("schools", { data: { name: "Ecole Test" } })

    const res = await validatePreEnrollment(
      form({
        preEnrollmentId: PRE_ID,
        collectPayment: "1",
        paymentMethod: "cash",
        amount: "150000",
      })
    )

    expect(res.error).toBeUndefined()
    expect(res.data?.matricule).toMatch(/^61CC-\d{4}-\d{4}$/)
    expect(res.data?.amountCollected).toBe(150000)
    expect(res.data?.receiptNumber).toBeTruthy()
    // P0-2 : l'encaissement passe par la RPC atomique record_payment
    // (plus aucun insert PostgREST direct sur payments/receipts).
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_payment",
      expect.objectContaining({ p_amount: 150000, p_payment_method: "cash" })
    )
    expect(writes.some((w) => w.table === "student_qr_codes" && w.op === "insert")).toBe(true)
    expect(mocks.alertEnrollmentConfirmed).toHaveBeenCalled()
  })
})

describe("completeCounterEnrollment", () => {
  it("refuse un professeur", async () => {
    stub("user_school_roles", { data: { school_id: SCHOOL_ID, role_code: "professeur" } })
    const res = await completeCounterEnrollment(
      form({
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianName: "Mariam",
        collectPayment: "1",
        paymentMethod: "cash",
        amount: "1000",
      })
    )
    expect(res.error).toBe("Action réservée à un rôle supérieur.")
  })

  it("inscrit au guichet et encaisse", async () => {
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    stub("students", { data: { id: "stu" }, error: null })
    stub("guardians", { data: null }, { data: { id: "g-new" }, error: null })
    stub("enrollments", { data: { id: "enr-2" }, error: null })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("schools", { data: { name: "Ecole Test" } })

    const res = await completeCounterEnrollment(
      form({
        firstName: "Awa",
        lastName: "Kone",
        dateOfBirth: "2012-01-01",
        gradeLevelId: GRADE_ID,
        guardianPhone: "+2250700000000",
        guardianName: "Mariam Kone",
        collectPayment: "1",
        paymentMethod: "cash",
        amount: "75000",
      })
    )

    expect(res.error).toBeUndefined()
    expect(res.data?.amountCollected).toBe(75000)
    // P0-2 : l'encaissement passe par la RPC atomique record_payment.
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_payment",
      expect.objectContaining({ p_amount: 75000, p_payment_method: "cash" })
    )
    const guardianInsert = writes.find((w) => w.table === "guardians" && w.op === "insert")
    expect(guardianInsert?.payload).toMatchObject({ full_name: "Mariam Kone" })
    const enrollmentInsert = writes.find((w) => w.table === "enrollments" && w.op === "insert")
    expect(enrollmentInsert?.payload).toMatchObject({
      school_id: SCHOOL_ID,
      status: "confirmed",
    })
  })
})
