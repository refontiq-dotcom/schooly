import { describe, expect, it } from "vitest"
import {
  calculateAge,
  capitalizeWords,
  formatGuardianPhone,
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

describe("capitalizeWords", () => {
  it("capitalise chaque mot séparé par espace, tiret ou apostrophe", () => {
    expect(capitalizeWords("jean-paul kouassi")).toBe("Jean-Paul Kouassi")
    expect(capitalizeWords("marie claire")).toBe("Marie Claire")
    expect(capitalizeWords("n'guessan")).toBe("N'Guessan")
    expect(capitalizeWords("jean")).toBe("Jean")
  })

  it("préserve les majuscules déjà tapées et les accents", () => {
    expect(capitalizeWords("DIALLO")).toBe("DIALLO")
    expect(capitalizeWords("éloge")).toBe("Éloge")
    expect(capitalizeWords("déborah-lou")).toBe("Déborah-Lou")
  })

  it("ne casse pas une saisie vide ou numérique", () => {
    expect(capitalizeWords("")).toBe("")
    expect(capitalizeWords("42")).toBe("42")
  })
})

describe("formatGuardianPhone", () => {
  it("groupe les chiffres par 2 (format ivoirien)", () => {
    expect(formatGuardianPhone("0700000000")).toBe("07 00 00 00 00")
    expect(formatGuardianPhone("07 00 00 00 00")).toBe("07 00 00 00 00")
  })

  it("isole l'indicatif +225", () => {
    expect(formatGuardianPhone("+2250700000000")).toBe("+225 07 00 00 00 00")
    expect(formatGuardianPhone("+225 07 00 00 00 00")).toBe("+225 07 00 00 00 00")
    // saisie en cours : « +225 » seul reste stable, pas de regroupement aberrant
    expect(formatGuardianPhone("+225")).toBe("+225 ")
  })

  it("normalise le 00 international en +", () => {
    expect(formatGuardianPhone("002250700000000")).toBe("+225 07 00 00 00 00")
  })

  it("reste déterministe : même saisie → même chaîne stockée", () => {
    const a = formatGuardianPhone("0700000000")
    const b = formatGuardianPhone("0700000000")
    expect(a).toBe(b)
  })

  it("tolère une saisie sans chiffre et la vide", () => {
    expect(formatGuardianPhone("")).toBe("")
    expect(formatGuardianPhone("abc")).toBe("abc")
  })
})

describe("calculateAge", () => {
  const now = new Date("2026-09-18T12:00:00")

  it("calcule l'âge en années révolues", () => {
    expect(calculateAge("2015-06-10", now)).toBe(11)
    expect(calculateAge("2015-12-31", now)).toBe(10) // anniversaire pas encore passé
  })

  it("gère anniversaire du jour et année de naissance = année courante", () => {
    expect(calculateAge("2008-09-18", now)).toBe(18)
    expect(calculateAge("2026-05-01", now)).toBe(0)
  })

  it("retourne null pour une date absente, future ou invalide", () => {
    expect(calculateAge("", now)).toBeNull()
    expect(calculateAge("2030-01-01", now)).toBeNull()
    expect(calculateAge("pas-une-date", now)).toBeNull()
  })
})
