// ============================================================================
// lib/payment-methods.ts — Source unique des modes de paiement.
//
// Importée à la fois par les schémas zod (validation serveur) et ré-exportée
// par enrollment-utils (compat des imports historiques) : une seule liste à
// tenir à jour quand un mode sera ajouté (ex. carte bancaire).
// ============================================================================

export const PAYMENT_METHODS = ["cash", "mobile_money", "check", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Libellés historiques du dashboard (sans accents, volontaire). */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Especes",
  mobile_money: "Mobile Money",
  check: "Cheque",
  transfer: "Virement bancaire",
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

const SCHOOL_PAYMENT_TYPE_MAP: Record<string, PaymentMethod> = {
  especes: "cash",
  esperes: "cash",
  cash: "cash",
  mobile_money: "mobile_money",
  virement_bancaire: "transfer",
  transfer: "transfer",
  cheque: "check",
  check: "check",
}

export function mapSchoolPaymentType(type: string | null | undefined): PaymentMethod | null {
  if (!type) return null
  return SCHOOL_PAYMENT_TYPE_MAP[type] ?? null
}
