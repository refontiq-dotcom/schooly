// apps/schooly/src/app/dashboard/pedagogie/grades/_lib/data.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  years: vi.fn(),
  classes: vi.fn(),
  subjects: vi.fn(),
  enrollments: vi.fn(),
  grades: vi.fn(),
  assessments: vi.fn(),
}))

vi.mock("../../actions", () => ({
  getAcademicYearsForSchool: mocks.years,
  getClassesForSchool: mocks.classes,
  getSubjectsForSchool: mocks.subjects,
  getEnrollmentsForSchool: mocks.enrollments,
  getGradeEntries: mocks.grades,
}))

// La configuration et les évaluations déclarées vivent dans evaluation-actions.
vi.mock("../../evaluation-actions", () => ({
  getEvaluationConfiguration: mocks.config,
  getEvaluationAssessments: mocks.assessments,
}))

import { loadEvaluationSnapshot } from "./data"

const RULES = [{ id: "r1", label: "Contrôle continu" }]
const PERIODS = [{ id: "p1", label: "Trimestre 1" }]

function respondOK() {
  mocks.config.mockResolvedValue({ data: { rules: RULES, periods: PERIODS }, error: undefined })
  mocks.years.mockResolvedValue({ data: [{ id: "y1", label: "2024-2025" }], error: undefined })
  mocks.classes.mockResolvedValue({ data: [{ id: "c1", name: "CM2 A" }], error: undefined })
  mocks.subjects.mockResolvedValue({ data: [{ id: "s1", name: "Maths" }], error: undefined })
  mocks.enrollments.mockResolvedValue({ data: [{ id: "e1" }], error: undefined })
  mocks.grades.mockResolvedValue({ data: [{ id: "g1" }], error: undefined })
  mocks.assessments.mockResolvedValue({ data: [{ id: "a1" }], error: undefined })
}

beforeEach(() => {
  vi.clearAllMocks()
  respondOK()
})

describe("loadEvaluationSnapshot", () => {
  it("agrège toutes les sources en un instantané unique", async () => {
    const result = await loadEvaluationSnapshot()

    expect(result.error).toBeUndefined()
    expect(result.data?.rules).toEqual(RULES)
    expect(result.data?.periods).toEqual(PERIODS)
    expect(result.data?.classes).toEqual([{ id: "c1", name: "CM2 A" }])
    expect(result.data?.subjects).toEqual([{ id: "s1", name: "Maths" }])
    expect(result.data?.enrollments).toHaveLength(1)
    expect(result.data?.grades).toHaveLength(1)
    expect(result.data?.assessments).toHaveLength(1)
  })

  it("remonte la première erreur et ne renvoie aucune donnée", async () => {
    mocks.classes.mockResolvedValue({ data: undefined, error: "DB down" })

    const result = await loadEvaluationSnapshot()

    expect(result).toEqual({ error: "DB down" })
    expect(result.data).toBeUndefined()
  })

  it("renvoie des listes vides quand la base ne renvoie rien", async () => {
    mocks.grades.mockResolvedValue({ data: undefined, error: undefined })
    mocks.assessments.mockResolvedValue({ data: null, error: undefined })

    const result = await loadEvaluationSnapshot()

    expect(result.data?.grades).toEqual([])
    expect(result.data?.assessments).toEqual([])
  })

  it("renvoie des copies neuves : aucune fuite d'état entre deux lectures", async () => {
    const first = await loadEvaluationSnapshot()
    const second = await loadEvaluationSnapshot()

    expect(first.data).not.toBe(second.data)
    expect(first.data?.grades).not.toBe(second.data?.grades)
    expect(first.data?.rules).toEqual(second.data?.rules)
  })

  it("ignore une mutation du consommateur sur la lecture suivante", async () => {
    const first = await loadEvaluationSnapshot()
    first.data?.grades.push({ id: "injecté" } as unknown as never)

    const second = await loadEvaluationSnapshot()

    expect(second.data?.grades).toHaveLength(1)
    expect(second.data?.grades[0]).toEqual({ id: "g1" })
  })
})
