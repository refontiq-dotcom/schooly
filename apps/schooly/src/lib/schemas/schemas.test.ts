import { describe, expect, it } from "vitest"
import {
  cashSessionCloseSchema,
  cashSessionOpenSchema,
  feeScheduleSchema,
  paymentActionSchema,
  paymentReminderSchema,
} from "./finance"
import {
  counterEnrollmentSchema,
  preEnrollmentPublicSchema,
  preEnrollmentValidateSchema,
} from "./admissions"
import { createMoratoriumSchema, decideMoratoriumSchema } from "./moratoriums"
import { manualDiscountSchema } from "./discount"
import { parseForm } from "./parse-form"

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

describe("paymentActionSchema (createPayment)", () => {
  const valid = {
    enrollmentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    amount: "15000",
    paymentMethod: "cash",
  }

  it("accepte un encaissement minimal", () => {
    const parsed = paymentActionSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.amount).toBe(15000)
      expect(parsed.data.allowOverpay).toBe(false)
      expect(parsed.data.reference).toBeNull()
    }
  })

  it("refuse un montant flottant, nul ou négatif", () => {
    expect(paymentActionSchema.safeParse({ ...valid, amount: "1500.5" }).success).toBe(false)
    expect(paymentActionSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false)
    expect(paymentActionSchema.safeParse({ ...valid, amount: "-500" }).success).toBe(false)
  })

  it("refuse un montant non numérique avec un message clair", () => {
    const parsed = paymentActionSchema.safeParse({ ...valid, amount: "abc" })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues[0].message).toContain("nombre")
  })

  it("refuse une méthode hors enum et un uuid invalide", () => {
    expect(paymentActionSchema.safeParse({ ...valid, paymentMethod: "bitcoin" }).success).toBe(false)
    expect(paymentActionSchema.safeParse({ ...valid, enrollmentId: "abc" }).success).toBe(false)
  })

  it("convertit la checkbox allowOverpay", () => {
    const on = paymentActionSchema.safeParse({ ...valid, allowOverpay: "on" })
    expect(on.success && on.data.allowOverpay).toBe(true)
  })
})

describe("cashSession schemas", () => {
  it("accepte un fond de caisse à 0 mais refuse le négatif", () => {
    expect(cashSessionOpenSchema.safeParse({ openingAmount: "0" }).success).toBe(true)
    expect(cashSessionOpenSchema.safeParse({ openingAmount: "-100" }).success).toBe(false)
    expect(cashSessionCloseSchema.safeParse({ closingAmount: "125000" }).success).toBe(true)
  })
})

describe("preEnrollmentPublicSchema (tunnel public)", () => {
  const base = {
    schoolId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    firstName: "Awa",
    lastName: "Diallo",
    dateOfBirth: "2015-04-12",
    gradeLevelId: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
    guardianPhone: "07 00 00 00 00",
    guardianRelation: "Mère",
    emergencyContactName: "Fatou Diallo",
    emergencyContactPhone: "0700000001",
    enrollmentType: "inscription",
    stateOrientation: "6e",
  }

  it("accepte une pré-inscription complète", () => {
    expect(preEnrollmentPublicSchema.safeParse(base).success).toBe(true)
  })

  it("refuse une date de naissance impossible ou future", () => {
    expect(preEnrollmentPublicSchema.safeParse({ ...base, dateOfBirth: "2015-02-31" }).success).toBe(false)
    expect(preEnrollmentPublicSchema.safeParse({ ...base, dateOfBirth: "2099-01-01" }).success).toBe(false)
  })

  it("refuse un téléphone trop court", () => {
    expect(preEnrollmentPublicSchema.safeParse({ ...base, guardianPhone: "123" }).success).toBe(false)
  })

  it("exige la paire école précédente / dernière classe", () => {
    const onlySchool = preEnrollmentPublicSchema.safeParse({ ...base, previousSchool: "EPP Bingerville" })
    expect(onlySchool.success).toBe(false)
    if (!onlySchool.success) {
      expect(onlySchool.error.issues[0].message).toContain("vont ensemble")
    }
    const both = preEnrollmentPublicSchema.safeParse({
      ...base,
      previousSchool: "EPP Bingerville",
      previousClass: "CM2",
    })
    expect(both.success).toBe(true)
  })
})

describe("preEnrollmentValidateSchema (guichet)", () => {
  const id = "3fa85f64-5717-4562-b3fc-2c963f66afa8"

  it("accepte sans encaissement", () => {
    expect(preEnrollmentValidateSchema.safeParse({ preEnrollmentId: id }).success).toBe(true)
  })

  it("exige montant et méthode si encaissement coché", () => {
    const parsed = preEnrollmentValidateSchema.safeParse({
      preEnrollmentId: id,
      collectPayment: "1",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message)
      expect(messages).toContain("Le montant encaissé est requis.")
      expect(messages).toContain("Le mode de paiement est requis.")
    }
    const ok = preEnrollmentValidateSchema.safeParse({
      preEnrollmentId: id,
      collectPayment: "1",
      amount: "10000",
      paymentMethod: "mobile_money",
    })
    expect(ok.success).toBe(true)
  })
})

describe("counterEnrollmentSchema (guichet direct)", () => {
  const base = {
    firstName: "Awa",
    lastName: "Diallo",
    dateOfBirth: "2015-04-12",
    gradeLevelId: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
    guardianPhone: "0700000000",
    guardianName: "Fatou Diallo",
  }

  it("encaisse par défaut (collectPayment absent = true)", () => {
    const parsed = counterEnrollmentSchema.safeParse(base)
    expect(parsed.success).toBe(false) // montant requis car collect par défaut
    const withPay = counterEnrollmentSchema.safeParse({
      ...base,
      amount: "25000",
      paymentMethod: "cash",
    })
    expect(withPay.success && withPay.data.collectPayment).toBe(true)
  })

  it("n'exige pas d'encaissement si explicitement désactivé", () => {
    const parsed = counterEnrollmentSchema.safeParse({ ...base, collectPayment: "0" })
    expect(parsed.success && parsed.data.amount).toBeUndefined()
  })
})

describe("moratoriums schemas", () => {
  const uuid = "3fa85f64-5717-4562-b3fc-2c963f66afa9"

  it("refuse un motif trop court ou une échéance invalide", () => {
    expect(createMoratoriumSchema.safeParse({
      enrollmentId: uuid, reason: "abc", requestedAmount: "50000", dueDate: "2026-12-31",
    }).success).toBe(false)
    expect(createMoratoriumSchema.safeParse({
      enrollmentId: uuid, reason: "Reports pour difficultés familiales", requestedAmount: "50000", dueDate: "2026-02-31",
    }).success).toBe(false)
  })

  it("accepte un rejet sans montant ni échéancier", () => {
    const parsed = decideMoratoriumSchema.safeParse({ moratoriumId: uuid, action: "reject" })
    expect(parsed.success).toBe(true)
  })

  it("borne l'échéancier entre 1 et 12", () => {
    expect(decideMoratoriumSchema.safeParse({ moratoriumId: uuid, action: "approve", installmentCount: "13" }).success).toBe(false)
    expect(decideMoratoriumSchema.safeParse({ moratoriumId: uuid, action: "approve", installmentCount: "3" }).success).toBe(true)
  })
})

describe("paymentReminderSchema", () => {
  it("refuse un canal hors liste", () => {
    const parsed = paymentReminderSchema.safeParse({
      enrollmentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      reminderType: "j0",
      channel: "pigeon",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues[0].message).toContain("Canal")
  })
})

describe("parseForm", () => {
  it("retourne les données typées", () => {
    const parsed = parseForm(cashSessionOpenSchema, formData({ openingAmount: "25000" }))
    expect(parsed.ok && parsed.data.openingAmount).toBe(25000)
  })

  it("retourne UN message FR lisible (première issue)", () => {
    const parsed = parseForm(paymentActionSchema, formData({
      enrollmentId: "oops",
      amount: "15000",
      paymentMethod: "cash",
    }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain("Inscription")
  })

  it("ignore les valeurs multi-valuées", () => {
    const fd = formData({ openingAmount: "100" })
    fd.append("openingAmount", "999")
    const parsed = parseForm(cashSessionOpenSchema, fd)
    expect(parsed.ok && parsed.data.openingAmount).toBe(100)
  })
})

describe("feeScheduleSchema (createFeeSchedule)", () => {
  const valid = {
    gradeLevelId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    amount: "25000",
    academicYearId: "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  }

  it("accepte une grille minimale (profil et intitulé optionnels → null)", () => {
    const parsed = feeScheduleSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.amount).toBe(25000)
      expect(parsed.data.financialProfileId).toBeNull()
      expect(parsed.data.label).toBeNull()
    }
  })

  it("refuse un montant nul ou flottant", () => {
    expect(feeScheduleSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false)
    expect(feeScheduleSchema.safeParse({ ...valid, amount: "1500.5" }).success).toBe(false)
  })

  it("refuse un identifiant non-UUID (niveau ou année)", () => {
    expect(feeScheduleSchema.safeParse({ ...valid, gradeLevelId: "niveau-1" }).success).toBe(false)
    expect(feeScheduleSchema.safeParse({ ...valid, academicYearId: "2026" }).success).toBe(false)
  })
})

describe("manualDiscountSchema (createManualDiscount)", () => {
  const valid = {
    enrollmentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    discountAmount: "5000",
  }

  it("accepte une remise minimale et applique le libellé par défaut", () => {
    const parsed = manualDiscountSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.discountLabel).toBe("Remise manuelle")
  })

  it("applique le libellé par défaut si le champ est vide ou en blanc", () => {
    const blank = manualDiscountSchema.safeParse({ ...valid, discountLabel: "   " })
    expect(blank.success && blank.data.discountLabel).toBe("Remise manuelle")
  })

  it("refuse un montant vide, nul ou négatif", () => {
    expect(manualDiscountSchema.safeParse({ ...valid, discountAmount: "" }).success).toBe(false)
    expect(manualDiscountSchema.safeParse({ ...valid, discountAmount: "0" }).success).toBe(false)
    expect(manualDiscountSchema.safeParse({ ...valid, discountAmount: "-100" }).success).toBe(false)
  })

  it("borne le libellé à 180 caractères", () => {
    expect(
      manualDiscountSchema.safeParse({ ...valid, discountLabel: "x".repeat(181) }).success
    ).toBe(false)
  })
})
