import { expect, it } from "vitest"
import { computeExpectedSubject, type EnteredGrade } from "./completeness"
import type { Rules } from "./calculations"
const rules: Rules = { mode: "TRIMESTRE", scale: 20, threshold: 10, rescueMargin: 0, categoryWeights: null }
const assessments = ["a", "b"].map(id => ({ id, grade_type: "devoir", max_value: 20, weight: 1 }))
const grade = (id: string | null, value: number | null, absence_status: "graded" | "excused" = "graded"): EnteredGrade => ({
  assessment_id: id, value, absence_status, max_value: 20, weight: 1, grade_type: "devoir",
})
it("détecte une évaluation sans aucune saisie", () => {
  expect(computeExpectedSubject(assessments, [grade("a", 12)], rules)).toEqual({
    average: { value: 12, complete: false }, entered: 1, expected: 2, unlinked: 0,
  })
})
it("compte zéro et ABS comme renseignés sans transformer ABS en zéro", () => {
  expect(computeExpectedSubject(assessments, [grade("a", 0), grade("b", null, "excused")], rules)).toEqual({
    average: { value: 0, complete: true }, entered: 2, expected: 2, unlinked: 0,
  })
})
it("toutes ABS : saisie complète mais moyenne non calculable", () => {
  const result = computeExpectedSubject(assessments, assessments.map(a => grade(a.id, null, "excused")), rules)
  expect(result.entered).toBe(2)
  expect(result.average).toEqual({ value: null, complete: false })
})
it("ne prouve pas la complétude avec une note non rattachée", () => {
  expect(computeExpectedSubject([], [grade(null, 14)], rules)).toEqual({
    average: { value: 14, complete: false }, entered: 0, expected: 0, unlinked: 1,
  })
})
it("ne déclare pas une matière sans plan complète", () => {
  expect(computeExpectedSubject([], [], rules).average.complete).toBe(false)
})
it("refuse les doubles saisies au lieu de gonfler le taux", () => {
  expect(() => computeExpectedSubject(assessments, [grade("a", 12), grade("a", 14)], rules)).toThrow()
})
it("le barème de référence est celui de l'évaluation attendue", () => {
  const result = computeExpectedSubject([{ ...assessments[0], max_value: 40 }], [grade("a", 30)], rules)
  expect(result.average).toEqual({ value: 15, complete: true })
})
