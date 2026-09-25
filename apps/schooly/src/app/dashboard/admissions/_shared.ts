import crypto from "crypto"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { alertEnrollmentConfirmed } from "@/lib/telegram"
import { recordPayment } from "@/lib/record-payment"
import { pickFeeAmount, type PaymentMethod } from "./enrollment-utils"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

export function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type EnrollmentQuote = {
  amount: number
  academicYearId: string
  academicYearLabel: string | null
}

export type CounterEnrollmentResult = {
  matricule: string
  receiptNumber?: string
  verificationCode?: string
  qrCode: string
  amountCollected: number
}

export type AdminClient = ReturnType<typeof adminClient>

export async function getCurrentAcademicYear(schoolId: string) {
  const admin = adminClient()
  const { data } = await admin
    .from("academic_years")
    .select("id, label")
    .eq("school_id", schoolId)
    .eq("status", "en_cours")
    .maybeSingle()
  return data
}

export async function quoteEnrollmentFees(
  admin: AdminClient,
  schoolId: string,
  gradeLevelId: string,
  academicYearId: string,
  financialProfileId?: string | null
): Promise<number> {
  const { data } = await admin
    .from("fee_schedules")
    .select("grade_level_id, academic_year_id, financial_profile_id, amount")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)

  return pickFeeAmount(data ?? [], gradeLevelId, academicYearId, financialProfileId)
}

export async function ensureGuardian(
  admin: AdminClient,
  phone: string,
  fullName: string
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await admin
    .from("guardians")
    .select("id")
    .eq("phone", phone)
    .maybeSingle()

  if (existing?.id) return { id: existing.id }

  const { data: created, error } = await admin
    .from("guardians")
    .insert({ phone, full_name: fullName })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { id: created.id }
}

export async function issueQrCode(
  admin: AdminClient,
  schoolId: string,
  enrollmentId: string
): Promise<string> {
  const qrCode = crypto.randomBytes(16).toString("hex")
  const { error } = await admin.from("student_qr_codes").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    qr_code: qrCode,
    is_active: true,
  })
  if (error && error.code !== "23505") {
    console.error("[admissions] QR insert failed:", error.message)
  }
  return qrCode
}

export async function collectPayment(opts: {
  admin: AdminClient
  schoolId: string
  userId: string
  enrollmentId: string
  amount: number
  paymentMethod: PaymentMethod
  reference: string | null
}): Promise<ActionResult<{ receiptNumber: string; verificationCode: string }>> {
  // P0-2 : écriture atomique + idempotente via la RPC `record_payment`.
  // requireCashSession=false : comportement historique du guichet — le cash
  // sans session ouverte est toléré (paiement non rattaché). allowOverpay=true :
  // le guichet ne connaît pas le solde au moment de l'encaissement (comportement
  // historique : aucun contrôle de dépassement côté admissions).
  const outcome = await recordPayment(opts.admin, {
    schoolId: opts.schoolId,
    enrollmentId: opts.enrollmentId,
    amount: opts.amount,
    paymentMethod: opts.paymentMethod,
    reference: opts.reference,
    cashSessionId: null,
    receivedBy: opts.userId,
    idempotencyKey: crypto.randomUUID(),
    allowOverpay: true,
    requireCashSession: false,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
  })

  if (!outcome.ok) return { error: outcome.error }
  return {
    data: {
      receiptNumber: outcome.row.receipt_number,
      verificationCode: outcome.row.verification_code,
    },
  }
}

export async function notifyEnrollment(schoolId: string, studentName: string, amount: number) {
  const admin = adminClient()
  const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle()
  await alertEnrollmentConfirmed({
    schoolName: school?.name ?? "Etablissement",
    studentName,
    amount,
  })
}
