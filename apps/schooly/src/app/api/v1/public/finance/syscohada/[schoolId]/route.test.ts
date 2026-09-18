// apps/schooly/src/app/api/v1/public/finance/syscohada/[schoolId]/route.test.ts
import { describe, it, expect } from "vitest"
import { fmt, toCSV, isValidSchoolId, isValidFormat } from "../helpers"

describe("helpers SYSCOHADA", () => {
  it("fmt formate un montant en FCFA", () => {
    expect(fmt(1234567)).toMatch(/1.*234.*567.*(?:XOF|F.*CFA)/)
  })

  it("toCSV produit 2 lignes (header + data) avec séparateur point-virgule", () => {
    const rows = [{ a: "Jean", b: 42 }]
    const csv = toCSV(rows, ["a", "b"])
    expect(csv.split("\n").length).toBe(2)
    expect(csv).toContain(" ; ")
  })

  it("isValidSchoolId valide un UUID v4", () => {
    expect(isValidSchoolId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true)
    expect(isValidSchoolId("nope")).toBe(false)
  })

  it("isValidFormat restreint aux formats SYSCOHADA", () => {
    expect(isValidFormat("general")).toBe(true)
    expect(isValidFormat("xyz")).toBe(false)
  })
})
