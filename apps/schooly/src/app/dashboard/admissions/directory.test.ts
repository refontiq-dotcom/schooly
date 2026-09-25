import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireSchoolRole: vi.fn(),
  getPreEnrollments: vi.fn(),
  getStudents: vi.fn(),
  getGuardians: vi.fn(),
  getEnrollments: vi.fn(),
}))

vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({}) }))
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
import { getDirectorySnapshot } from "./directory"

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
