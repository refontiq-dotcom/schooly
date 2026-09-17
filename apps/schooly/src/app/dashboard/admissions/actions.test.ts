import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  alertEnrollmentConfirmed: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/telegram", () => ({
  alertEnrollmentConfirmed: mocks.alertEnrollmentConfirmed,
}))

import { completeCounterEnrollment, createPreEnrollment, validatePreEnrollment } from "./actions"

const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"
const PRE_ID = "pre-1"
const YEAR_ID = "year-1"
const GRADE_ID = "grade-1"

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
  }))
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
      })
    )
    expect(res).toEqual({ error: "Établissement introuvable." })
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
        birthCertificateNumber: "ACTE-1",
        paymentMethodId: "pm-1",
        acceptedChecklist: '["c1"]',
        providedDocuments: '["d1"]',
      })
    )

    expect(res.error).toBeUndefined()
    expect(res.data?.code).toMatch(/^[A-Z2-9]{6}$/)
    const insert = writes.find((w) => w.table === "pre_enrollments" && w.op === "insert")
    expect(insert?.payload).toMatchObject({
      guardian_name: "Mariam Kone",
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

  it("cree eleve, inscription, paiement et recu", async () => {
    stub("pre_enrollments", { data: pending }, { data: { id: PRE_ID } })
    stub("grade_levels", { data: { id: GRADE_ID } })
    stub("academic_years", { data: { id: YEAR_ID, label: "2026-2027" } })
    stub("students", { data: { id: "stu" }, error: null })
    stub("guardians", { data: { id: "g1" } })
    stub("enrollments", { data: { id: "enr-1" }, error: null })
    stub("student_qr_codes", { data: { id: "qr" }, error: null })
    stub("payments", { data: { id: "pay-1" }, error: null })
    stub("receipts", { data: { id: "r1" }, error: null })
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
    expect(writes.some((w) => w.table === "payments" && w.op === "insert")).toBe(true)
    expect(writes.some((w) => w.table === "receipts" && w.op === "insert")).toBe(true)
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
    stub("payments", { data: { id: "pay-2" }, error: null })
    stub("receipts", { data: { id: "r2" }, error: null })
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
    const guardianInsert = writes.find((w) => w.table === "guardians" && w.op === "insert")
    expect(guardianInsert?.payload).toMatchObject({ full_name: "Mariam Kone" })
    const enrollmentInsert = writes.find((w) => w.table === "enrollments" && w.op === "insert")
    expect(enrollmentInsert?.payload).toMatchObject({
      school_id: SCHOOL_ID,
      status: "confirmed",
    })
  })
})
