import { describe, expect, it } from "vitest"
import {
  generateEnrollmentMatricule,
  isPaymentMethod,
  mapSchoolPaymentType,
  parseIdList,
  pickFeeAmount,
} from "./enrollment-utils"

describe("mapSchoolPaymentType", () => {
  it("aligne les types etablissement sur les modes caisse", () => {
    expect(mapSchoolPaymentType("especes")).toBe("cash")
    expect(mapSchoolPaymentType("esperes")).toBe("cash")
    expect(mapSchoolPaymentType("virement_bancaire")).toBe("transfer")
    expect(mapSchoolPaymentType("cheque")).toBe("check")
    expect(mapSchoolPaymentType("mobile_money")).toBe("mobile_money")
    expect(mapSchoolPaymentType("inconnu")).toBeNull()
  })
})

describe("parseIdList", () => {
  it("lit un tableau JSON de chaines", () => {
    expect(parseIdList('["a","b"]')).toEqual(["a", "b"])
  })

  it("ignore le JSON invalide", () => {
    expect(parseIdList("not-json")).toEqual([])
    expect(parseIdList(null)).toEqual([])
  })
})

describe("isPaymentMethod", () => {
  it("n'accepte que les 4 modes caisse", () => {
    expect(isPaymentMethod("cash")).toBe(true)
    expect(isPaymentMethod("especes")).toBe(false)
  })
})

describe("generateEnrollmentMatricule", () => {
  it("prefixe par 4 caracteres d'ecole et l'annee", () => {
    const code = generateEnrollmentMatricule("61ccee8e-f135-4223-b5ce-88a450142e22", new Date("2026-09-17"))
    expect(code).toMatch(/^61CC-2026-\d{4}$/)
  })
})

describe("pickFeeAmount", () => {
  const fees = [
    { grade_level_id: "g1", academic_year_id: "y1", financial_profile_id: null, amount: 150_000 },
    { grade_level_id: "g1", academic_year_id: "y1", financial_profile_id: "boursier", amount: 50_000 },
    { grade_level_id: "g2", academic_year_id: "y1", financial_profile_id: null, amount: 200_000 },
  ]

  it("prend le tarif standard du niveau", () => {
    expect(pickFeeAmount(fees, "g1", "y1")).toBe(150_000)
  })

  it("prend le profil financier s'il existe", () => {
    expect(pickFeeAmount(fees, "g1", "y1", "boursier")).toBe(50_000)
  })

  it("retourne 0 sans grille", () => {
    expect(pickFeeAmount(fees, "g9", "y1")).toBe(0)
  })
})
