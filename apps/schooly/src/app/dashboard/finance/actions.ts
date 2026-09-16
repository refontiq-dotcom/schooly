"use server"

import { createClient } from "@/utils/supabase/server"
import { CASHIER_ROLES, PRICING_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

import { denial, requireSchoolRole } from "@/utils/supabase/require-role"

// ============================================ GRILLE TARIFAIRE =================

export async function getFeeSchedules(schoolId: string) {
  const supabase = await createClient()

  // Garde cross-tenant : le school_id client est refusé s'il diffère de
  // l'école de la session (IDOR constaté à l'audit : lecture d'une autre
  // école possible avec un simple paramètre).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

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
    .eq("school_id", guard.context.schoolId)
    .order("academic_year_id", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createFeeSchedule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Écriture sensible (argent) : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

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
    school_id: schoolId,
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

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

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
    .eq("school_id", guard.context.schoolId)
    .order("received_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createPayment(formData: FormData): Promise<ActionResult<{ receiptNumber: string; verificationCode: string }>> {
  const supabase = await createClient()

  // Encaissement : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

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

  if (!enrollment || enrollment.school_id !== schoolId) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { data: payment, error: paymentError } = await admin.from("payments").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    amount,
    payment_method: paymentMethod,
    reference: reference || null,
    cash_session_id: cashSessionId || null,
    received_by: userId,
  }).select("id").single()

  if (paymentError) return { error: paymentError.message }

  const verificationCode = crypto.randomBytes(16).toString("hex").toUpperCase()
  const receiptNumber = `R-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const qrCodeData = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify/${verificationCode}`

  const { error: receiptError } = await admin.from("receipts").insert({
    school_id: schoolId,
    payment_id: payment.id,
    receipt_number: receiptNumber,
    verification_code: verificationCode,
    qr_code_data: qrCodeData,
    issued_by: userId,
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

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, null)

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

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

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

  // Ouverture de caisse : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const openingAmount = parseInt(formData.get("openingAmount") as string || "0")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await admin
    .from("cash_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "open")
    .single()

  if (existing) return { error: "Une session de caisse est déjà ouverte." }

  const { error } = await admin.from("cash_sessions").insert({
    school_id: schoolId,
    opened_by: userId,
    opening_amount: openingAmount,
    status: "open",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/caisse")
  return {}
}

export async function closeCashSession(formData: FormData): Promise<ActionResult<{ expected: number; difference: number }>> {
  const supabase = await createClient()

  // Clôture de caisse : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const closingAmount = parseInt(formData.get("closingAmount") as string || "0")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: session } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("school_id", schoolId)
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
    closed_by: userId,
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

/**
 * EXCEPTION VOLONTAIRE — pas de garde requireSchoolRole ici.
 * Appelée par le tunnel public `/verify/[code]` (page de vérification d'un reçu
 * par quiconque possède le lien QR imprimé sur le reçu). L'authentification
 * casserait ce tunnel. Le secret réside dans le code lui-même : 128 bits
 * d'aléa (`crypto.randomBytes(16)`), impossible à énumérer. Les données
 * retournées sont limitées au contenu du reçu (pas de liste ni de balayage).
 * Cf. docs/security/audit-socle-auth-tenancy.md — module Finance.
 */
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

export async function getAccountingExports(requestedSchoolId: string) {
  const supabase = await createClient()

  // Lecture des exports comptables : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...PRICING_ROLES],
    requestedSchoolId,
  })
  if (!guard.ok) return { error: denial(guard.reason, []).error, data: [] }

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
    .eq("school_id", guard.context.schoolId)
    .order("generated_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

type AccountingPaymentRow = {
  amount: number
  payment_method: string | null
  received_at: string | null
  enrollments: {
    matricule: string | null
    students: { first_name: string; last_name: string } | null
    guardians: { full_name: string | null } | null
  } | null
}

type AccountingExportLine = {
  date: string | null
  matricule: string | null
  eleve: string
  tuteur: string | null
  mode: string | null
  montant: number
}

export async function generateAccountingExport(formData: FormData): Promise<ActionResult<{ csvContent: string; totalDebit: number; totalCredit: number; lineCount: number }>> {
  const supabase = await createClient()

  // Export comptable (données sensibles) : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

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
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .gte("received_at", periodStart)
    .lte("received_at", periodEnd)
    .is("deleted_at", null)

  // L'inférence supabase-js (sans schéma DB généré) décrit les relations
  // embarquées comme des tableaux ; au runtime PostgREST renvoie bien des
  // objets pour les relations N:1 (payments→enrollments→students/guardians).
  // Cast via `unknown` : la sûreté réside dans le mapper normalisé ci-dessous.
  const paymentList = (payments ?? []) as unknown as AccountingPaymentRow[]

  let totalDebit = 0
  let totalCredit = 0
  const lines: AccountingExportLine[] = []

  for (const payment of paymentList) {
    totalDebit += payment.amount
    totalCredit += payment.amount
    const enrollment = payment.enrollments
    const eleve = [
      enrollment?.students?.last_name,
      enrollment?.students?.first_name,
    ]
      .filter(Boolean)
      .join(" ")
    lines.push({
      date: payment.received_at ?? null,
      matricule: enrollment?.matricule ?? null,
      eleve: eleve || "—",
      tuteur: enrollment?.guardians?.full_name ?? null,
      mode: payment.payment_method ?? null,
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
    school_id: schoolId,
    academic_year_id: academicYearId,
    export_type: exportType,
    period_start: periodStart,
    period_end: periodEnd,
    generated_by: userId,
  })

  if (exportError) return { error: exportError.message }

  revalidatePath("/dashboard/direction/finance")
  return { data: { csvContent, totalDebit, totalCredit, lineCount: lines.length } }
}
