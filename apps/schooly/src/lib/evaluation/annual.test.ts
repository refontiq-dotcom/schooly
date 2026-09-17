import { describe, expect, it } from "vitest"
import { computeAnnualPreview, type AnnualPeriod } from "./annual"
import type { Rules } from "./calculations"

const rules: Rules = { mode: "TRIMESTRE", scale: 20, threshold: 10, rescueMargin: 0.2, categoryWeights: null }
const now = Date.parse("2027-07-01T00:00:00Z")
const period = (position: number, value = 12, extra: Partial<AnnualPeriod> = {}): AnnualPeriod => ({
  id: `p${position}`, position, isPassage: false,
  startsAt: `2027-0${position}-01T00:00:00Z`, endsAt: `2027-0${position + 1}-01T00:00:00Z`,
  lockedAt: null, average: { value, complete: true }, ...extra,
})
const preview = (periods: AnnualPeriod[], extra: Partial<Rules> = {}, time = now) => computeAnnualPreview(periods, { ...rules, ...extra }, time)

describe("aperçu annuel", () => {
  it("calcule trois trimestres sans arrondi et reconnaît le verrouillage à échéance", () => {
    const result = preview([period(3, 13), period(1, 10), period(2, 12)])
    expect(result.average).toEqual({ value: 35 / 3, complete: true })
    expect(result.proposal).toBe("admitted")
    expect(result.readyForValidation).toBe(true)
    expect(result.blockers).toEqual([])
  })
  it("calcule deux semestres", () => {
    expect(preview([period(1, 8), period(2, 12)], { mode: "SEMESTRE" }).average.value).toBe(10)
  })
  it("applique 40 % aux compositions régulières et 60 % au passage", () => {
    const result = preview([period(1, 10), period(2, 14), period(3, 16, { isPassage: true })], { mode: "COMPOSITION_PRIMAIRE" })
    expect(result.average.value).toBeCloseTo(14.4)
    expect(result.readyForValidation).toBe(true)
  })
  it.each([[], [period(1)], [period(1), period(2)], [period(1), period(2), period(4)]].map(periods => ({ periods })))("bloque un calendrier trimestriel incomplet", ({ periods }) => {
    expect(preview(periods).proposal).toBe("incomplete")
    expect(preview(periods).readyForValidation).toBe(false)
  })
  it.each([
    [period(1)], [period(1, 12, { isPassage: true })],
    [period(1), period(2, 12, { isPassage: true }), period(3, 12, { isPassage: true })],
  ].map(periods => ({ periods })))("exige des compositions régulières et un passage unique", ({ periods }) => {
    expect(preview(periods, { mode: "COMPOSITION_PRIMAIRE" }).average.complete).toBe(false)
  })
  it("refuse une composition de passage dans le régime semestriel", () => {
    expect(preview([period(1), period(2, 12, { isPassage: true })], { mode: "SEMESTRE" }).readyForValidation).toBe(false)
  })
  it.each([{ value: 15, complete: false }, { value: null, complete: false }])("n'admet jamais une période incomplète ou toutes ABS", average => {
    const result = preview([period(1), period(2), period(3, 12, { average })])
    expect(result.average.value).toBeNull()
    expect(result.proposal).toBe("incomplete")
  })
  it("conserve zéro et propose un ajournement", () => {
    expect(preview([period(1, 0), period(2, 0), period(3, 0)]).proposal).toBe("deferred")
  })
  it("ne transforme pas un arrondi affiché en admission", () => {
    expect(preview([period(1, 9.999), period(2, 9.999), period(3, 9.999)]).proposal).toBe("rescuable")
  })
  it("distingue calcul complet et disponibilité pour validation", () => {
    const result = preview([period(1), period(2), period(3)], {}, Date.parse("2027-03-15T00:00:00Z"))
    expect(result.average.complete).toBe(true)
    expect(result.readyForValidation).toBe(false)
    expect(result.allPeriodsClosed).toBe(false)
  })
  it("reconnaît une clôture anticipée et la borne de fin exclusive", () => {
    const time = Date.parse("2027-03-15T00:00:00Z")
    expect(preview([period(1), period(2), period(3, 12, { lockedAt: "2027-03-14T00:00:00Z" })], {}, time).readyForValidation).toBe(true)
    expect(preview([period(1), period(2), period(3)], {}, Date.parse("2027-04-01T00:00:00Z")).readyForValidation).toBe(true)
  })
  it("rejette doublons, dates et moyennes invalides", () => {
    expect(() => preview([period(1), period(1)])).toThrow()
    for (const extra of [{ startsAt: "invalide" }, { lockedAt: "2028-01-01" }, { average: { value: NaN, complete: true } }, { average: { value: 21, complete: false } }]) {
      expect(() => preview([period(1, 12, extra)])).toThrow()
    }
    expect(() => preview([period(1), period(2, 12, { startsAt: "2027-01-15" })])).toThrow("chevauchent")
    expect(() => preview([], {}, NaN)).toThrow()
  })
})
