import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  sessionFrom: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  createUser: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}))

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { inviteStaffMember, setStaffActive, updateStaffRole } from "./actions"

const SCHOOL_ID = "61ccee8e-f135-4223-b5ce-88a450142e22"
const USER_ID = "0f7d00f9-9af5-43ed-b0b0-0e824385e97c"

type QueryResult = { data?: unknown; error?: unknown; count?: number }
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
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
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
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mocks.sessionFrom.mockImplementation((table: string) => builderFor(table))
  mocks.createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null })
  mocks.createAdminClient.mockImplementation(() => ({
    from: (table: string) => builderFor(table),
    auth: { admin: { createUser: mocks.createUser } },
  }))
  stub("user_school_roles", DIRECTION)
})

function form(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

describe("inviteStaffMember", () => {
  it("crée le compte et rattache le rôle", async () => {
    stub("users", { data: null }, { data: null, error: null })
    stub("user_school_roles", DIRECTION, { data: null }, { data: null, error: null })

    const res = await inviteStaffMember(form({
      fullName: "Ama Kouassi",
      email: "ama@ecole.ci",
      roleCode: "professeur",
      password: "secret123",
    }))

    expect(res.error).toBeUndefined()
    expect(res.data?.created).toBe(true)
    expect(res.data?.password).toBe("secret123")
    expect(writes.some((w) => w.table === "user_school_roles" && w.op === "insert")).toBe(true)
  })

  it("refuse un membre déjà rattaché", async () => {
    stub("users", { data: { id: "existing" } })
    stub("user_school_roles", DIRECTION, { data: { id: "role-1" } })

    const res = await inviteStaffMember(form({
      fullName: "Ama Kouassi",
      email: "ama@ecole.ci",
      roleCode: "caisse",
    }))

    expect(res.error).toMatch(/déjà/)
  })
})

describe("updateStaffRole", () => {
  it("bloque le retrait du dernier directeur", async () => {
    stub("user_school_roles", DIRECTION, {
      data: { id: "m1", user_id: "other", role_code: "direction", is_active: true },
    }, { count: 0, data: null })

    const res = await updateStaffRole(form({ membershipId: "m1", roleCode: "caisse" }))
    expect(res.error).toMatch(/dernier compte direction/)
  })
})

describe("setStaffActive", () => {
  it("empêche de se désactiver soi-même", async () => {
    stub("user_school_roles", DIRECTION, {
      data: { id: "m1", user_id: USER_ID, role_code: "direction", is_active: true },
    })

    const res = await setStaffActive(form({ membershipId: "m1", isActive: "false" }))
    expect(res.error).toMatch(/propre accès/)
  })
})
