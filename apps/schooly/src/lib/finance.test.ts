import { describe, expect, it } from "vitest"
import { addMonthsISO, monthsBetween, planFeeItems } from "./finance"

describe("planFeeItems — découpe du dû en tranches", () => {
  const YEAR_START = "2026-09-15"
  const YEAR_END = "2027-07-15"

  it("annuel : une seule ligne, montant exact, échéance à la rentrée", () => {
    const items = planFeeItems({
      totalAmount: 180000,
      plan: "annuel",
      yearStart: YEAR_START,
      yearEnd: YEAR_END,
      yearLabel: "2026-2027",
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      label: "Scolarité 2026-2027",
      amount: 180000,
      position: 1,
      dueDate: YEAR_START,
    })
  })

  it("trimestriel : 3 tranches égales, dates croissantes dans l'année", () => {
    const items = planFeeItems({
      totalAmount: 180000,
      plan: "trimestriel",
      yearStart: YEAR_START,
      yearEnd: YEAR_END,
    })
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.amount)).toEqual([60000, 60000, 60000])
    expect(items.map((i) => i.label)).toEqual(["Tranche 1/3", "Tranche 2/3", "Tranche 3/3"])
    const dates = items.map((i) => i.dueDate)
    dates.forEach((d) => {
      expect(d).not.toBeNull()
      expect(d! >= YEAR_START).toBe(true)
      expect(d! <= YEAR_END).toBe(true)
    })
    expect(dates[0]! < dates[1]!).toBe(true)
    expect(dates[1]! < dates[2]!).toBe(true)
  })

  it("trimestriel : l'arrondi est porté par la première tranche (somme exacte)", () => {
    const items = planFeeItems({
      totalAmount: 100001,
      plan: "trimestriel",
      yearStart: YEAR_START,
      yearEnd: YEAR_END,
    })
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(100001)
    expect(items[0].amount).toBe(33335)
    expect(items[1].amount).toBe(33333)
    expect(items[2].amount).toBe(33333)
  })

  it("mensuel : une tranche par mois scolaire, somme exacte", () => {
    const items = planFeeItems({
      totalAmount: 90000,
      plan: "mensuel",
      yearStart: YEAR_START,
      yearEnd: YEAR_END,
    })
    // 2026-09 → 2027-07 = 10 mois
    expect(items).toHaveLength(10)
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(90000)
    expect(items[0].label).toBe("Tranche 1/10")
    expect(items[9].label).toBe("Tranche 10/10")
  })

  it("refuse un montant invalide ou des bornes absentes", () => {
    expect(
      planFeeItems({ totalAmount: 0, plan: "annuel", yearStart: YEAR_START, yearEnd: YEAR_END })
    ).toEqual([])
    expect(
      planFeeItems({
        totalAmount: 50000,
        plan: "annuel",
        yearStart: "",
        yearEnd: YEAR_END,
      })
    ).toEqual([])
  })
})

describe("addMonthsISO / monthsBetween — bornes de dates", () => {
  it("écrête le jour quand le mois cible est plus court", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonthsISO("2027-01-31", 1)).toBe("2027-02-28")
  })

  it("compte les mois d'une année scolaire ivoirienne", () => {
    expect(monthsBetween("2026-09-15", "2027-07-15")).toBe(10)
    expect(monthsBetween("2026-09-15", "2026-09-20")).toBe(1)
  })
})
