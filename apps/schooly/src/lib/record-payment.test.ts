import { describe, expect, it } from "vitest"
import { mapRecordPaymentError } from "./record-payment"

describe("mapRecordPaymentError", () => {
  it("mappe les raises RPC vers les messages FR actuels", () => {
    expect(mapRecordPaymentError("ENROLLMENT_NOT_FOUND")).toBe(
      "Inscription introuvable ou accès non autorisé."
    )
    expect(mapRecordPaymentError("CASH_SESSION_REQUIRED")).toBe(
      "Ouvrez une session de caisse avant d'encaisser en espèces."
    )
    expect(mapRecordPaymentError("INVALID_AMOUNT")).toBe(
      "Le montant encaissé doit être un entier positif (FCFA)."
    )
    expect(mapRecordPaymentError("INVALID_PAYMENT_METHOD")).toBe(
      "Mode de paiement inconnu."
    )
  })

  it("formule le refus de dépassement avec le solde restant", () => {
    expect(mapRecordPaymentError("OVERPAY_NOT_ALLOWED:15000")).toContain("15")
    expect(mapRecordPaymentError("OVERPAY_NOT_ALLOWED:0")).toContain("déjà soldé")
    expect(mapRecordPaymentError("OVERPAY_NOT_ALLOWED:-5000")).toContain("déjà soldé")
  })

  it("signale le doublon sur violation d'unicité", () => {
    expect(
      mapRecordPaymentError('duplicate key value violates unique constraint "uq_payments_school_idem"')
    ).toContain("déjà enregistré")
  })

  it("laisse passer les messages inconnus tels quels", () => {
    expect(mapRecordPaymentError("boom")).toBe("boom")
  })
})
