import { describe, expect, it } from "vitest"
import {
  SIBLING_DEFAULT_RATE,
  capDiscounts,
  planScholarshipDiscount,
  planSiblingDiscounts,
} from "./discounts"

describe("planSiblingDiscounts — remise fratrie", () => {
  const group = {
    guardianId: "g1",
    enrollments: [
      { enrollmentId: "e-ainé", matricule: "SCH-2026-0001" },
      { enrollmentId: "e-cadet", matricule: "SCH-2026-0002" },
      { enrollmentId: "e-benjamin", matricule: "SCH-2026-0003" },
    ],
  }
  const expected = { "e-ainé": 180000, "e-cadet": 180000, "e-benjamin": 180000 }

  it("l'aîné (1er matricule) paye plein, les suivants reçoivent la remise", () => {
    const plans = planSiblingDiscounts(group, expected)
    expect(plans).toHaveLength(2)
    expect(plans.map((p) => p.enrollmentId)).toEqual(["e-cadet", "e-benjamin"])
    expect(plans[0].amount).toBe(18000) // 10 % de 180000
    expect(plans[0].rank).toBe(2)
    expect(plans[1].rank).toBe(3)
    expect(plans[0].label).toContain("10 %")
  })

  it("taux personnalisable (ex. 15 %)", () => {
    const plans = planSiblingDiscounts(group, expected, 15)
    expect(plans[0].amount).toBe(27000)
  })

  it("enfant unique : aucune remise", () => {
    const solo = {
      guardianId: "g2",
      enrollments: [{ enrollmentId: "e-solo", matricule: "SCH-2026-0099" }],
    }
    expect(planSiblingDiscounts(solo, { "e-solo": 180000 })).toEqual([])
  })

  it("sans matricule : tri déterministe par id, aucune erreur", () => {
    const noMat = {
      guardianId: "g3",
      enrollments: [
        { enrollmentId: "b", matricule: null },
        { enrollmentId: "a", matricule: null },
      ],
    }
    const plans = planSiblingDiscounts(noMat, { a: 50000, b: 50000 })
    expect(plans).toHaveLength(1)
    expect(plans[0].enrollmentId).toBe("b") // "a" classé premier → plein
  })

  it("attendu à 0 (grille absente) : pas de remise fabriquée", () => {
    const plans = planSiblingDiscounts(group, {
      "e-ainé": 180000,
      "e-cadet": 0,
      "e-benjamin": 0,
    })
    expect(plans).toEqual([])
  })

  it("taux par défaut = 10 %", () => {
    expect(SIBLING_DEFAULT_RATE).toBe(10)
  })
})

describe("planScholarshipDiscount — bourse", () => {
  it("boursier : remise au taux demandé", () => {
    const plan = planScholarshipDiscount({
      enrollmentId: "e1",
      scholarshipStatus: "boursier",
      expectedAmount: 200000,
      rate: 50,
    })
    expect(plan).not.toBeNull()
    expect(plan!.amount).toBe(100000)
    expect(plan!.label).toContain("50 %")
  })

  it("non_boursier / inconnu : rien", () => {
    expect(
      planScholarshipDiscount({ enrollmentId: "e1", scholarshipStatus: "non_boursier", expectedAmount: 200000, rate: 50 })
    ).toBeNull()
    expect(
      planScholarshipDiscount({ enrollmentId: "e1", scholarshipStatus: "inconnu", expectedAmount: 200000, rate: 50 })
    ).toBeNull()
  })

  it("taux invalide ou attendu nul : rien", () => {
    expect(
      planScholarshipDiscount({ enrollmentId: "e1", scholarshipStatus: "boursier", expectedAmount: 200000, rate: 0 })
    ).toBeNull()
    expect(
      planScholarshipDiscount({ enrollmentId: "e1", scholarshipStatus: "boursier", expectedAmount: 200000, rate: 150 })
    ).toBeNull()
    expect(
      planScholarshipDiscount({ enrollmentId: "e1", scholarshipStatus: "boursier", expectedAmount: 0, rate: 50 })
    ).toBeNull()
  })
})

describe("capDiscounts — jamais d'attendu négatif", () => {
  it("fratrie + bourse + manuelle <= attendu : tout passe", () => {
    const { capped, removed } = capDiscounts(200000, [
      { amount: 18000 },
      { amount: 50000 },
      { amount: 2000 },
    ])
    expect(capped).toHaveLength(3)
    expect(removed).toBe(0)
    expect(capped.reduce((s, d) => s + d.amount, 0)).toBe(70000)
  })

  it("dépassement : la dernière remise est écrêtée puis retirée", () => {
    const { capped, removed } = capDiscounts(50000, [
      { amount: 30000 },
      { amount: 30000 }, // dépasse → écrêtée à 20000
      { amount: 5000 },  // plus rien → retirée
    ])
    expect(capped).toHaveLength(2)
    expect(capped[1].amount).toBe(20000)
    expect(removed).toBe(1)
    expect(capped.reduce((s, d) => s + d.amount, 0)).toBe(50000)
  })
})
