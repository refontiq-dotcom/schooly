import { describe, expect, it } from "vitest"
import { parsePreEnrollmentDraft } from "./pre-enrollment-draft"

describe("parsePreEnrollmentDraft", () => {
  it("conserve les champs texte et normalise les booléens", () => {
    expect(parsePreEnrollmentDraft(JSON.stringify({
      firstName: "Awa",
      previousClass: "6ème A",
      sameEmergencyContact: false,
      firstEnrollment: true,
    }))).toMatchObject({
      firstName: "Awa",
      previousClass: "6ème A",
      sameEmergencyContact: false,
      firstEnrollment: true,
    })
  })

  it("retourne null pour une absence, un JSON invalide ou une valeur non objet", () => {
    expect(parsePreEnrollmentDraft(null)).toBeNull()
    expect(parsePreEnrollmentDraft("{broken")).toBeNull()
    expect(parsePreEnrollmentDraft("42")).toBeNull()
  })

  it("ignore les valeurs non textuelles sans contaminer les autres champs", () => {
    expect(parsePreEnrollmentDraft(JSON.stringify({
      firstName: 42,
      guardianPhone: "0707070707",
    }))).toEqual({ guardianPhone: "0707070707" })
  })
})
