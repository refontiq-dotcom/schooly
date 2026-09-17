import { describe, expect, it } from "vitest"
import { computeAnnualAverage, computePeriodAverage, computeSubjectAverage, proposeDecision, validateRules, type Grade, type Rules } from "./calculations"

const rules: Rules = { mode: "TRIMESTRE", scale: 20, threshold: 10, rescueMargin: 0.2, categoryWeights: null }
const note = (value: number | null, extra: Partial<Grade> = {}): Grade => ({
  value, maxValue: 20, weight: 1, category: "devoir", status: "graded", ...extra,
})
const average = (value: number | null, complete = value !== null) => ({ value, complete })

describe("moteur d'évaluation", () => {
  it("normalise les barèmes et applique les poids sans arrondi", () => {
    expect(computeSubjectAverage([note(10), note(7, { maxValue: 10, weight: 2 })], rules).value).toBe(38 / 3)
  })
  it("distingue zéro, ABS et saisie manquante", () => {
    expect(computeSubjectAverage([note(0), note(10)], rules)).toEqual(average(5))
    expect(computeSubjectAverage([note(null, { status: "excused" }), note(10)], rules)).toEqual(average(10))
    expect(computeSubjectAverage([note(null, { status: "missing" }), note(10)], rules)).toEqual(average(10, false))
    expect(computeSubjectAverage([note(null, { status: "excused" })], rules)).toEqual(average(null))
    expect(computeSubjectAverage([], rules)).toEqual(average(null))
    expect(computeSubjectAverage([note(0, { weight: 0 })], rules)).toEqual(average(null))
  })
  it("pondère les catégories et non leur nombre d'évaluations", () => {
    const configured = { ...rules, categoryWeights: { interrogation: 40, devoir: 60, composition: 0 } }
    expect(computeSubjectAverage([note(10, { category: "interrogation" }), note(14, { category: "interrogation" }), note(18)], configured).value).toBeCloseTo(15.6)
    expect(computeSubjectAverage([note(18)], configured)).toEqual(average(null))
    expect(computeSubjectAverage([note(15, { category: "composition" })], {
      ...rules, categoryWeights: { interrogation: 0, devoir: 0, composition: 100 },
    })).toEqual(average(15))
  })
  it("agrège selon les coefficients matière, avec couverture explicite", () => {
    expect(computePeriodAverage([{ average: average(12), coefficient: 4 }, { average: average(15), coefficient: 2 }])).toEqual(average(13))
    expect(computePeriodAverage([{ average: average(12), coefficient: 4 }, { average: average(null), coefficient: 2 }])).toEqual(average(12, false))
    expect(computePeriodAverage([])).toEqual(average(null))
  })
  it("calcule les trois régimes et refuse une année incomplète", () => {
    expect(computeAnnualAverage([8, 10, 12].map(n => average(n)), rules)).toEqual(average(10))
    expect(computeAnnualAverage([9, 11].map(n => average(n)), { ...rules, mode: "SEMESTRE" })).toEqual(average(10))
    expect(computeAnnualAverage([average(12)], { ...rules, mode: "COMPOSITION_PRIMAIRE" }, average(15)).value).toBeCloseTo(13.8)
    expect(computeAnnualAverage([average(10)], rules)).toEqual(average(null))
    expect(computeAnnualAverage([average(12)], { ...rules, mode: "COMPOSITION_PRIMAIRE" })).toEqual(average(null))
    expect(computeAnnualAverage([average(100)], { ...rules, mode: "COMPOSITION_PRIMAIRE", scale: 200, threshold: 100 }, average(150))).toEqual(average(130))
  })
  it.each([
    [10, "admitted"], [9.85, "rescuable"], [9.999, "rescuable"], [9, "deferred"],
  ] as const)("propose une décision pour %s sans arrondi", (value, decision) => {
    expect(proposeDecision(average(value), rules)).toBe(decision)
  })
  it("n'admet pas un résultat provisoire", () => {
    expect(proposeDecision(average(15, false), rules)).toBe("incomplete")
  })
  it("rejette les paramètres et notes invalides", () => {
    for (const value of [NaN, Infinity, -1, 21]) {
      expect(() => computeSubjectAverage([note(value)], rules)).toThrow()
    }
    expect(() => computeSubjectAverage([note(0, { maxValue: 0 })], rules)).toThrow()
    expect(() => computeSubjectAverage([note(10, { status: "excused" })], rules)).toThrow()
    expect(() => validateRules({ ...rules, categoryWeights: { interrogation: 20, devoir: 60, composition: 0 } })).toThrow()
    expect(() => computePeriodAverage([{ average: average(10), coefficient: 0 }])).toThrow()
  })
})
