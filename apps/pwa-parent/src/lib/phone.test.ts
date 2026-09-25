import { describe, it, expect } from "vitest"
import { normalizePhone, parentSyntheticEmail } from "./phone"

describe("normalizePhone (miroir de la fonction SQL normalize_phone)", () => {
  it("normalise un numéro local", () => {
    expect(normalizePhone("0700000000")).toBe("+2250700000000")
  })

  it("tolère les espaces et séparateurs", () => {
    expect(normalizePhone("07 00 00 00 00")).toBe("+2250700000000")
    expect(normalizePhone("+225 07 00 00 00 00")).toBe("+2250700000000")
  })

  it("retire les préfixes internationaux", () => {
    expect(normalizePhone("+2250700000000")).toBe("+2250700000000")
    expect(normalizePhone("002250700000000")).toBe("+2250700000000")
    expect(normalizePhone("2250700000000")).toBe("+2250700000000")
  })

  it("retourne null pour une saisie vide", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone("abc")).toBeNull()
  })
})

describe("parentSyntheticEmail", () => {
  it("dérive un email unique du téléphone normalisé", () => {
    expect(parentSyntheticEmail("+2250700000000")).toBe("2250700000000@parents.schooly.app")
  })
})
