import { expect, it } from "vitest"
import { isValidMovementCode, movementCodeChecksum, movementKind, normalizeMovementCode } from "./code"

it("calcule le checksum attendu pour un corps connu", () => {
  // Vecteur partagé avec `movement_code_checksum` en base : TRF0123 → E.
  expect(movementCodeChecksum("TRF0123")).toBe("E")
  expect(isValidMovementCode("TRF0123E")).toBe(true)
})

it("refuse un code dont le checksum ne correspond pas", () => {
  expect(isValidMovementCode("TRF0123D")).toBe(false)
})

it("refuse les longueurs et préfixes hors format", () => {
  expect(movementCodeChecksum("TRF012")).toBeNull()
  expect(movementCodeChecksum("ABC0123")).toBeNull()
  expect(isValidMovementCode("TRF0123")).toBe(false)
  expect(isValidMovementCode("TRF0123EE")).toBe(false)
})

it("refuse les symboles exclus de l'alphabet (I, L, O, U)", () => {
  expect(movementCodeChecksum("TRF0I23")).toBeNull()
  expect(movementCodeChecksum("TRF0O23")).toBeNull()
})

it("distingue les préfixes TRF et ORT", () => {
  expect(movementKind("TRF0123E")).toBe("TRF")
  expect(movementKind("ORT0123E")).toBe("ORT")
  expect(movementKind("XXX0123E")).toBeNull()
})

it("normalise une saisie avec espaces, tirets et minuscules", () => {
  expect(normalizeMovementCode(" trf-0123 e ")).toBe("TRF0123E")
  expect(isValidMovementCode(normalizeMovementCode(" trf-0123 e "))).toBe(true)
})
