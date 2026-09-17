export const PAYMENT_METHODS = ["cash", "mobile_money", "check", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Especes",
  mobile_money: "Mobile Money",
  check: "Cheque",
  transfer: "Virement bancaire",
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

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

export function parseIdList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

export function generateEnrollmentMatricule(schoolId: string, now = new Date()): string {
  const year = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  return `${schoolId.slice(0, 4).toUpperCase()}-${year}-${seq}`
}

export function pickFeeAmount(
  fees: Array<{
    grade_level_id: string | null
    academic_year_id: string
    financial_profile_id: string | null
    amount: number
  }>,
  gradeLevelId: string,
  academicYearId: string,
  financialProfileId?: string | null
): number {
  const forLevel = fees.filter(
    (fee) => fee.grade_level_id === gradeLevelId && fee.academic_year_id === academicYearId
  )
  if (forLevel.length === 0) return 0
  if (financialProfileId) {
    const specific = forLevel.find((fee) => fee.financial_profile_id === financialProfileId)
    if (specific) return specific.amount
  }
  const standard = forLevel.find((fee) => fee.financial_profile_id == null)
  return (standard ?? forLevel[0]).amount
}
