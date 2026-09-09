"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

type SchoolRoleResult = { school_id: string | null; error: Error | null }

async function getSchoolId(userId: string): Promise<SchoolRoleResult> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single()
  
  return { school_id: data?.school_id ?? null, error }
}

// ============================================ GRILLE TARIFAIRE =================

export async function getFeeSchedules(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("fee_schedules")
    .select(`
      *,
      grade_levels ( name ),
      financial_profiles ( name ),
      academic_years ( label )
    `)
    .eq("school_id", schoolId)
    .order("academic_year_id", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createFeeSchedule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const gradeLevelId = formData.get("gradeLevelId") as string
  const financialProfileId = formData.get("financialProfileId") as string | null
  const amount = parseInt(formData.get("amount") as string || "0")
  const academicYearId = formData.get("academicYearId") as string
  const label = formData.get("label") as string | null

  if (!gradeLevelId || !academicYearId || amount <= 0) {
    return { error: "Niveau, année académique et montant valide sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("fee_schedules").insert({
    school_id: roleData.school_id,
    grade_level_id: gradeLevelId,
    financial_profile_id: financialProfileId || null,
    amount,
    academic_year_id: academicYearId,
    label: label || null,
  })

  if (error) {
    if (error.code === "23505") return { error: "Cette grille tarifaire existe déjà." }
    return { error: error.message }
  }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ PAIEMENTS ========================

export async function getPayments(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("payments")
    .select(`
      *,
      enrollments (
        matricule,
        students ( first_name, last_name ),
        guardians ( full_name, phone )
      ),
      users ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("received_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createPayment(formData: FormData): Promise<ActionResult<{ receiptNumber: string; verificationCode: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const enrollmentId = formData.get("enrollmentId") as string
  const amount = parseInt(formData.get("amount") as string || "0")
  const paymentMethod = formData.get("paymentMethod") as string
  const reference = formData.get("reference") as string | null
  const cashSessionId = formData.get("cashSessionId") as string | null

  if (!enrollmentId || amount <= 0 || !paymentMethod) {
    return { error: "Inscription, montant et méthode de paiement sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("school_id")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment || enrollment.school_id !== roleData.school_id) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { data: payment, error: paymentError } = await admin.from("payments").insert({
    school_id: roleData.school_id,
    enrollment_id: enrollmentId,
    amount,
    payment_method: paymentMethod,
    reference: reference || null,
    cash_session_id: cashSessionId || null,
    received_by: user.id,
  }).select("id").single()

  if (paymentError) return { error: paymentError.message }

  const verificationCode = crypto.randomBytes(16).toString("hex").toUpperCase()
  const receiptNumber = `R-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const qrCodeData = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify/${verificationCode}`

  const { error: receiptError } = await admin.from("receipts").insert({
    school_id: roleData.school_id,
    payment_id: payment.id,
    receipt_number: receiptNumber,
    verification_code: verificationCode,
    qr_code_data: qrCodeData,
    issued_by: user.id,
  })

  if (receiptError) return { error: receiptError.message }

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/direction/finance")
  return { data: { receiptNumber, verificationCode } }
}

// ============================================ SESSIONS DE CAISSE ================

export async function getOpenCashSession(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: null }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("status", "open")
    .single()

  return { data: data || null }
}

export async function getCashSessions(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("cash_sessions")
    .select(`
      *,
      users!cash_sessions_opened_by_fkey ( full_name ),
      users!cash_sessions_closed_by_fkey ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("opened_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function openCashSession(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const openingAmount = parseInt(formData.get("openingAmount") as string || "0")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await admin
    .from("cash_sessions")
    .select("id")
    .eq("school_id", roleData.school_id)
    .eq("status", "open")
    .single()

  if (existing) return { error: "Une session de caisse est déjà ouverte." }

  const { error } = await admin.from("cash_sessions").insert({
    school_id: roleData.school_id,
    opened_by: user.id,
    opening_amount: openingAmount,
    status: "open",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/caisse")
  return {}
}

export async function closeCashSession(formData: FormData): Promise<ActionResult<{ expected: number; difference: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const closingAmount = parseInt(formData.get("closingAmount") as string || "0")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: session } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("school_id", roleData.school_id)
    .eq("status", "open")
    .single()

  if (!session) return { error: "Aucune session ouverte." }

  const { data: payments } = await admin
    .from("payments")
    .select("amount")
    .eq("cash_session_id", session.id)
    .is("deleted_at", null)

  const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
  const expected = session.opening_amount + totalPayments
  const difference = closingAmount - expected

  const { error } = await admin.from("cash_sessions").update({
    closed_by: user.id,
    closing_amount: closingAmount,
    expected_amount: expected,
    difference,
    status: "closed",
    closed_at: new Date().toISOString(),
  }).eq("id", session.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/caisse/close")
  return { data: { expected, difference } }
}

// ============================================ VÉRIFICATION PUBLIQUE ==============

export async function verifyReceipt(verificationCode: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: receipt } = await admin
    .from("receipts")
    .select(`
      *,
      payments (
        amount,
        payment_method,
        reference,
        received_at,
        enrollments (
          matricule,
          students ( first_name, last_name ),
          guardians ( full_name, phone )
        )
      ),
      schools ( name, city )
    `)
    .eq("verification_code", verificationCode.toUpperCase())
    .is("deleted_at", null)
    .single()

  if (!receipt) return { error: "Reçu introuvable.", data: null }

  return { data: receipt, error: null }
}

// ============================================ EXPORTS COMPTABLES ================

export async function getAccountingExports(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("accounting_exports")
    .select(`
      *,
      academic_years ( label )
    `)
    .eq("school_id", schoolId)
    .order("generated_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function generateAccountingExport(formData: FormData): Promise<ActionResult<{ csvContent: string; totalDebit: number; totalCredit: number; lineCount: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const academicYearId = formData.get("academicYearId") as string
  const exportType = formData.get("exportType") as string
  const periodStart = formData.get("periodStart") as string
  const periodEnd = formData.get("periodEnd") as string

  if (!academicYearId || !exportType || !periodStart || !periodEnd) {
    return { error: "Tous les champs sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payments } = await admin
    .from("payments")
    .select(`
      amount,
      payment_method,
      received_at,
      enrollments (
        matricule,
        students ( first_name, last_name ),
        guardians ( full_name )
      )
    `)
    .eq("school_id", roleData.school_id)
    .eq("academic_year_id", academicYearId)
    .gte("received_at", periodStart)
    .lte("received_at", periodEnd)
    .is("deleted_at", null)

  const paymentList = (payments || []) as any[]

  let totalDebit = 0
  let totalCredit = 0
  const lines: any[] = []

  for (const payment of paymentList) {
    totalDebit += payment.amount
    totalCredit += payment.amount
    lines.push({
      date: payment.received_at,
      matricule: payment.enrollments?.matricule,
      eleve: `${payment.enrollments?.students?.last_name} ${payment.enrollments?.students?.first_name}`,
      tuteur: payment.enrollments?.guardians?.full_name,
      mode: payment.payment_method,
      montant: payment.amount,
    })
  }

  if (totalDebit !== totalCredit) {
    return { error: `Déséquilibre comptable : débit=${totalDebit} crédit=${totalCredit}` }
  }

  let csvContent = "Date;Matricule;Élève;Tuteur;Mode;Montant\n"
  for (const line of lines) {
    csvContent += `${line.date};${line.matricule};${line.eleve};${line.tuteur};${line.mode};${line.montant}\n`
  }

  const { error: exportError } = await admin.from("accounting_exports").insert({
    school_id: roleData.school_id,
    academic_year_id: academicYearId,
    export_type: exportType,
    period_start: periodStart,
    period_end: periodEnd,
    generated_by: user.id,
  })

  if (exportError) return { error: exportError.message }

  revalidatePath("/dashboard/direction/finance")
  return { data: { csvContent, totalDebit, totalCredit, lineCount: lines.length } }
}
