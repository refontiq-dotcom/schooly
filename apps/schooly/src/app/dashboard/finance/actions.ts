"use server"

import { createClient } from "@/utils/supabase/server"
import { CASHIER_ROLES, PRICING_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { generateFeeItemsForEnrollment } from "@/lib/finance-fees"
import { SIBLING_DEFAULT_RATE, planSiblingDiscounts } from "@/lib/discounts"

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
    .is("deleted_at", null)
    .order("received_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createPayment(formData: FormData): Promise<ActionResult<{ receiptNumber: string; verificationCode: string; balanceAfter: number | null }>> {
  const supabase = await createClient()

  // Encaissement : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const amount = parseInt(formData.get("amount") as string || "0")
  const paymentMethod = formData.get("paymentMethod") as string
  const reference = formData.get("reference") as string | null
  const allowOverpay = formData.get("allowOverpay") === "on"

  if (!enrollmentId || amount <= 0 || !paymentMethod) {
    return { error: "Inscription, montant et méthode de paiement sont requis." }
  }
  const VALID_METHODS = ["cash", "mobile_money", "check", "transfer"] as const
  if (!VALID_METHODS.includes(paymentMethod as (typeof VALID_METHODS)[number])) {
    return { error: "Mode de paiement inconnu." }
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

  // Session de caisse OBLIGATOIRE pour l'espèces : l'argent physique doit être
  // retrouvé à la clôture. L'id de session vient du SERVEUR — jamais du client.
  let sessionId: string | null = null
  if (paymentMethod === "cash") {
    const { data: openSession } = await admin
      .from("cash_sessions")
      .select("id")
      .eq("school_id", schoolId)
      .eq("status", "open")
      .is("deleted_at", null)
      .maybeSingle()
    if (!openSession) {
      return { error: "Ouvrez une session de caisse avant d'encaisser en espèces." }
    }
    sessionId = openSession.id
  }

  // Solde : impossible d'encaisser au-delà du reste à payer sans le déclarer
  // explicitement comme une avance volontaire.
  const { data: feeRows } = await admin
    .from("student_fee_items")
    .select("amount")
    .eq("enrollment_id", enrollmentId)
    .is("deleted_at", null)
  const { data: paidRows } = await admin
    .from("payments")
    .select("amount")
    .eq("enrollment_id", enrollmentId)
    .is("deleted_at", null)
  const hasFeeItems = (feeRows ?? []).length > 0
  const expected = (feeRows ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  const paid = (paidRows ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0)
  const balance = expected - paid
  if (hasFeeItems && amount > balance && !allowOverpay) {
    return {
      error:
        balance > 0
          ? `Montant supérieur au solde restant (${balance.toLocaleString("fr-FR")} FCFA). Cochez « Enregistrer comme avance » si c'est volontaire.`
          : "Cet élève est déjà soldé. Cochez « Enregistrer comme avance » pour un versement volontaire.",
    }
  }

  const { data: payment, error: paymentError } = await admin.from("payments").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    amount,
    payment_method: paymentMethod,
    reference: reference || null,
    cash_session_id: sessionId,
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
  return { data: { receiptNumber, verificationCode, balanceAfter: hasFeeItems ? balance - amount : null } }
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

// ============================================ CONFIG GRILLE (UI) ================

/**
 * Données du formulaire de grille tarifaire : grilles existantes + listes
 * (profils financiers, niveaux, années). Remplace les cartes statiques de
 * l'ancien dashboard (« Disponible sur demande »…).
 */
export async function getFinanceConfig(schoolId: string) {
  const supabase = await createClient()

  // Lecture + configuration tarifaire : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...PRICING_ROLES],
    requestedSchoolId: schoolId,
  })
  if (!guard.ok) return { error: denial(guard.reason, []).error, data: null }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [schedulesRes, profilesRes, levelsRes, yearsRes] = await Promise.all([
    admin
      .from("fee_schedules")
      .select("id, amount, label, grade_level_id, financial_profile_id, academic_year_id, financial_profiles ( name ), grade_levels ( name ), academic_years ( label )")
      .eq("school_id", guard.context.schoolId)
      .is("deleted_at", null)
      .order("academic_year_id", { ascending: false }),
    admin
      .from("financial_profiles")
      .select("id, name")
      .eq("school_id", guard.context.schoolId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    admin
      .from("grade_levels")
      .select("id, name, level")
      .eq("school_id", guard.context.schoolId)
      .is("deleted_at", null)
      .order("level", { ascending: true }),
    admin
      .from("academic_years")
      .select("id, label, status")
      .eq("school_id", guard.context.schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ])

  if (schedulesRes.error) return { error: schedulesRes.error.message, data: null }

  return {
    data: {
      schedules: schedulesRes.data ?? [],
      profiles: profilesRes.data ?? [],
      gradeLevels: levelsRes.data ?? [],
      years: yearsRes.data ?? [],
    },
  }
}

/**
 * Duplique la grille d'une année vers une autre (la rentrée N+1 en 1 clic).
 * Les lignes déjà présentes sur l'année cible (même niveau × profil) sont
 * ignorées — re-duplication sans doublon.
 */
export async function duplicateFeeSchedule(
  formData: FormData
): Promise<ActionResult<{ copied: number; skipped: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const sourceYearId = formData.get("sourceYearId") as string
  const targetYearId = formData.get("targetYearId") as string

  if (!sourceYearId || !targetYearId) {
    return { error: "Année source et année cible sont requises." }
  }
  if (sourceYearId === targetYearId) {
    return { error: "L'année cible doit être différente de l'année source." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sourceRows, error: sourceError } = await admin
    .from("fee_schedules")
    .select("grade_level_id, financial_profile_id, amount, label")
    .eq("school_id", schoolId)
    .eq("academic_year_id", sourceYearId)
    .is("deleted_at", null)

  if (sourceError) return { error: sourceError.message }
  if (!sourceRows?.length) {
    return { error: "Aucune ligne à dupliquer sur l'année source." }
  }

  const { data: existing } = await admin
    .from("fee_schedules")
    .select("grade_level_id, financial_profile_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", targetYearId)
    .is("deleted_at", null)

  type FeeRow = { grade_level_id: string | null; financial_profile_id: string | null; amount: number; label: string | null }
  const existingKeys = new Set(
    (existing ?? []).map((e: { grade_level_id: string | null; financial_profile_id: string | null }) =>
      `${e.grade_level_id ?? "none"}:${e.financial_profile_id ?? "none"}`
    )
  )

  const toInsert = ((sourceRows ?? []) as FeeRow[])
    .filter((row) => !existingKeys.has(`${row.grade_level_id ?? "none"}:${row.financial_profile_id ?? "none"}`))
    .map((row) => ({
      school_id: schoolId,
      grade_level_id: row.grade_level_id,
      financial_profile_id: row.financial_profile_id,
      amount: row.amount,
      label: row.label,
      academic_year_id: targetYearId,
    }))

  const skipped = (sourceRows as FeeRow[]).length - toInsert.length
  if (toInsert.length > 0) {
    const { error } = await admin.from("fee_schedules").insert(toInsert)
    if (error) {
      if (error.code === "23505") return { error: "Certaines lignes existent déjà sur l'année cible." }
      return { error: error.message }
    }
  }

  revalidatePath("/dashboard/direction/finance")
  return { data: { copied: toInsert.length, skipped } }
}

/** Retire une ligne de la grille (soft delete, anti-IDOR vérifié). */
export async function deleteFeeSchedule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const id = formData.get("id") as string
  if (!id) return { error: "Ligne introuvable." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: row } = await admin
    .from("fee_schedules")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!row) return { error: "Ligne introuvable dans la grille de cet établissement." }

  const { error } = await admin
    .from("fee_schedules")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ SOLDES & IMPAYÉS ==================

/** Une ligne de la vue v_student_balances (solde d'une inscription). */
export type StudentBalance = {
  enrollment_id: string
  school_id: string
  matricule: string | null
  first_name: string
  last_name: string
  guardian_name: string | null
  guardian_phone: string | null
  grade_level_name: string | null
  class_name: string | null
  academic_year_label: string | null
  has_fee_items: boolean
  expected_total: number
  paid_total: number
  balance: number
  next_due_date: string | null
  next_due_amount: number | null
  last_payment_at: string | null
}

/**
 * Soldes de toutes les inscriptions de l'année : attendu / payé / reste,
 * prochaine échéance. Source unique des impayés (direction) et du guichet
 * (solde affiché AVANT l'encaissement).
 */
export async function getStudentBalances(schoolId: string, academicYearId?: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = admin
    .from("v_student_balances")
    .select("*")
    .eq("school_id", guard.context.schoolId)
    .order("balance", { ascending: false })

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: (data ?? []) as StudentBalance[] }
}

/** KPI du tableau de bord finance : tout en une seule lecture de la vue. */
export async function getFinanceOverview(schoolId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, null)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: balances, error } = await admin
    .from("v_student_balances")
    .select("*")
    .eq("school_id", guard.context.schoolId)

  if (error) return { error: error.message, data: null }

  const rows = (balances ?? []) as StudentBalance[]
  const withItems = rows.filter((r) => r.has_fee_items)
  const expected = withItems.reduce((s, r) => s + (r.expected_total || 0), 0)
  const paid = withItems.reduce((s, r) => s + (r.paid_total || 0), 0)
  const unpaid = withItems.filter((r) => r.balance > 0)
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // Encaissements du jour et du mois (espèces, MM, chèque, virement confondus).
  const monthStartISO = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  ).toISOString()
  const [payRes, sessionRes] = await Promise.all([
    admin
      .from("payments")
      .select("amount, received_at")
      .eq("school_id", guard.context.schoolId)
      .is("deleted_at", null)
      .gte("received_at", monthStartISO),
    admin
      .from("cash_sessions")
      .select("id, opened_at, opening_amount, users ( full_name )")
      .eq("school_id", guard.context.schoolId)
      .eq("status", "open")
      .is("deleted_at", null)
      .maybeSingle(),
  ])

  const recent = (payRes.data ?? []) as Array<{ amount: number; received_at: string }>
  const todayPrefix = new Date().toISOString().slice(0, 10)
  const todayList = recent.filter((p) => p.received_at.slice(0, 10) === todayPrefix)

  return {
    data: {
      expectedTotal: expected,
      paidTotal: paid,
      collectionRate: expected > 0 ? Math.round((paid / expected) * 100) : null,
      enrollmentCount: rows.length,
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((s, r) => s + r.balance, 0),
      topUnpaid: unpaid.slice(0, 10),
      upcomingDue: withItems.filter(
        (r) => r.balance > 0 && r.next_due_date && r.next_due_date <= weekAhead
      ),
      todayTotal: todayList.reduce((s, p) => s + p.amount, 0),
      todayCount: todayList.length,
      monthTotal: recent.reduce((s, p) => s + p.amount, 0),
      openCashSession: sessionRes.data ?? null,
    },
  }
}

// ============================================ ANNULATION PAIEMENT ===============

/**
 * Annule un encaissement (erreur de saisie) : soft delete + motif OBLIGATOIRE.
 * La ligne reste en base pour l'audit ; les soldes se recalculent seuls (les
 * vues excluent deleted_at).
 */
export async function cancelPayment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Annulation d'argent : direction / compta uniquement (pas la caisse).
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const paymentId = formData.get("paymentId") as string
  const reason = (formData.get("cancelReason") as string)?.trim()

  if (!paymentId) return { error: "Paiement introuvable." }
  if (!reason || reason.length < 5) {
    return { error: "Un motif d'au moins 5 caractères est obligatoire pour annuler un encaissement." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payment } = await admin
    .from("payments")
    .select("id, deleted_at")
    .eq("id", paymentId)
    .eq("school_id", schoolId)
    .maybeSingle()

  if (!payment) return { error: "Paiement introuvable dans cet établissement." }
  if (payment.deleted_at) return { error: "Ce paiement est déjà annulé." }

  const now = new Date().toISOString()
  const { error: payError } = await admin
    .from("payments")
    .update({ deleted_at: now, cancel_reason: reason })
    .eq("id", paymentId)

  if (payError) return { error: payError.message }

  // Le reçu correspondant est invalidé : la page publique /verify le signale.
  await admin
    .from("receipts")
    .update({ deleted_at: now })
    .eq("payment_id", paymentId)
    .is("deleted_at", null)

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ ÉCHÉANCIERS MANQUANTS =============

/**
 * Génère les échéanciers manquants : pour chaque inscription de l'année sans
 * student_fee_items, applique la grille tarifaire (plan annuel par défaut).
 * Idempotent — les inscriptions déjà dotées sont ignorées.
 */
export async function generateMissingFeeItems(
  formData: FormData
): Promise<ActionResult<{ generated: number; withoutFee: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const academicYearId = formData.get("academicYearId") as string
  if (!academicYearId) return { error: "Année académique requise." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rows, error } = await admin
    .from("v_student_balances")
    .select("enrollment_id, grade_level_id, academic_year_id, has_fee_items")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)

  if (error) return { error: error.message }

  const targets = (rows ?? []).filter((r: { has_fee_items: boolean }) => !r.has_fee_items)
  let generated = 0
  let withoutFee = 0

  for (const row of targets as Array<{ enrollment_id: string; grade_level_id: string }>) {
    const result = await generateFeeItemsForEnrollment(admin, {
      schoolId,
      enrollmentId: row.enrollment_id,
      academicYearId,
      gradeLevelId: row.grade_level_id,
      plan: "annuel",
    })
    if (result.ok) generated += result.items
    else if (result.reason === "no_fee_schedule") withoutFee += 1
  }

  revalidatePath("/dashboard/direction/finance")
  return { data: { generated, withoutFee } }
}

// ============================================ RÉDUCTIONS ========================

type DiscountRow = { id: string; kind: string; label: string; amount: number; reason: string | null; created_at: string }

/** Lignes de réduction d'une inscription (audit des remises fratrie/bourse). */
export async function getEnrollmentDiscounts(schoolId: string, enrollmentId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("fee_discounts")
    .select("id, kind, label, amount, reason, created_at")
    .eq("enrollment_id", enrollmentId)
    .eq("school_id", guard.context.schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: (data ?? []) as DiscountRow[] }
}

/** Ajoute une remise manuelle (direction/compta) — plafonnée au solde attendu. */
export async function createManualDiscount(
  formData: FormData
): Promise<ActionResult<{ applied: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const amount = parseInt(formData.get("discountAmount") as string || "0")
  const label = (formData.get("discountLabel") as string)?.trim() || "Remise manuelle"

  if (!enrollmentId || amount <= 0) {
    return { error: "Inscription et montant de remise valides requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: enr } = await admin
    .from("enrollments")
    .select("id, fee_expected")
    .eq("id", enrollmentId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!enr) return { error: "Inscription introuvable dans cet établissement." }
  if (!enr.fee_expected || enr.fee_expected <= 0) {
    return { error: "Aucun échéancier sur cette inscription — générez-le avant d'appliquer une remise." }
  }

  // Plafond : remises existantes + nouvelle <= attendu.
  const { data: existing } = await admin
    .from("fee_discounts")
    .select("amount")
    .eq("enrollment_id", enrollmentId)
    .is("deleted_at", null)

  const existingTotal = (existing ?? []).reduce(
    (s: number, r: { amount: number }) => s + r.amount, 0
  )
  const room = enr.fee_expected - existingTotal
  if (room <= 0) {
    return { error: "Le total des remises atteint déjà le montant attendu." }
  }
  const applied = Math.min(amount, room)

  const { error } = await admin.from("fee_discounts").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    kind: "manuel",
    label,
    amount: applied,
    created_by: userId,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return { data: { applied } }
}

/** Retire une remise (soft delete). */
export async function deleteDiscount(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const id = formData.get("id") as string
  if (!id) return { error: "Remise introuvable." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: row } = await admin
    .from("fee_discounts")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!row) return { error: "Remise introuvable dans cet établissement." }

  const { error } = await admin
    .from("fee_discounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

/**
 * Applique les remises fratrie en masse pour l'année : groupe les inscriptions
 * par parent (guardian), trie par matricule, remise de 10 % (configurable)
 * dès le 2e enfant. Idempotent : mise à jour si le taux change, jamais de
 * doublon, remises obsolètes (enfant devenu unique) retirées.
 */
export async function applySiblingDiscounts(
  formData: FormData
): Promise<ActionResult<{ groups: number; discounts: number; skipped: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const academicYearId = formData.get("academicYearId") as string
  const rateInput = parseInt(formData.get("rate") as string || "0")
  const rate = rateInput > 0 && rateInput <= 50 ? rateInput : SIBLING_DEFAULT_RATE

  if (!academicYearId) return { error: "Année académique requise." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rows, error } = await admin
    .from("v_student_balances")
    .select("enrollment_id, matricule, expected_total, has_fee_items")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)

  if (error) return { error: error.message }

  const list = (rows ?? []) as Array<{
    enrollment_id: string
    matricule: string | null
    expected_total: number
    has_fee_items: boolean
  }>

  const { data: guardianLinks } = await admin
    .from("enrollments")
    .select("id, guardian_id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)

  const guardianByEnrollment = new Map<string, string>()
  for (const link of (guardianLinks ?? []) as Array<{ id: string; guardian_id: string }>) {
    guardianByEnrollment.set(link.id, link.guardian_id)
  }

  const expectedByEnrollment: Record<string, number> = {}
  for (const row of list) expectedByEnrollment[row.enrollment_id] = row.expected_total

  const groups = new Map<string, Array<{ enrollmentId: string; matricule: string | null }>>()
  for (const row of list) {
    if (!row.has_fee_items) continue
    const guardianId = guardianByEnrollment.get(row.enrollment_id)
    if (!guardianId) continue
    const bucket = groups.get(guardianId) ?? []
    bucket.push({ enrollmentId: row.enrollment_id, matricule: row.matricule })
    groups.set(guardianId, bucket)
  }

  let discountCount = 0
  let groupCount = 0
  let skipped = 0

  for (const [guardianId, enrollments] of groups) {
    if (enrollments.length < 2) continue
    groupCount += 1
    const plans = planSiblingDiscounts({ guardianId, enrollments }, expectedByEnrollment, rate)

    const enrollmentIds = enrollments.map((e) => e.enrollmentId)
    const { data: existing } = await admin
      .from("fee_discounts")
      .select("id, enrollment_id, amount")
      .in("enrollment_id", enrollmentIds)
      .eq("kind", "fratrie")
      .is("deleted_at", null)

    const existingByEnrollment = new Map<string, { id: string; amount: number }>()
    for (const ex of (existing ?? []) as Array<{ id: string; enrollment_id: string; amount: number }>) {
      existingByEnrollment.set(ex.enrollment_id, { id: ex.id, amount: ex.amount })
    }

    for (const plan of plans) {
      const existingRow = existingByEnrollment.get(plan.enrollmentId)
      if (existingRow) {
        if (existingRow.amount !== plan.amount) {
          await admin
            .from("fee_discounts")
            .update({ amount: plan.amount, label: plan.label })
            .eq("id", existingRow.id)
          discountCount += 1
        } else {
          skipped += 1
        }
        continue
      }
      const { error: insertError } = await admin.from("fee_discounts").insert({
        school_id: schoolId,
        enrollment_id: plan.enrollmentId,
        kind: "fratrie",
        label: plan.label,
        amount: plan.amount,
        reason: `Fratrie guardian ${guardianId} — ${enrollments.length} enfants, taux ${plan.rate} %`,
        created_by: userId,
      })
      if (!insertError) discountCount += 1
    }

    for (const [enrollmentId, existingRow] of existingByEnrollment) {
      const stillPlanned = plans.some((p) => p.enrollmentId === enrollmentId)
      if (!stillPlanned) {
        await admin
          .from("fee_discounts")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", existingRow.id)
      }
    }
  }

  revalidatePath("/dashboard/direction/finance")
  return { data: { groups: groupCount, discounts: discountCount, skipped } }
}

// ============================================ RELANCES AUTOMATIQUES =============

/**
 * Génère les relances du jour : pour chaque inscription impayée dont la
 * prochaine échéance est passée ou imminente, pousse un message WhatsApp dans
 * notification_outbox (file avec retry — l'envoi réel est le travail du
 * worker). Idempotent par clé de template : un parent n'est relancé qu'UNE
 * fois par échéance et par palier (J-5 / J+1 / J+7), grâce au check
 * d'existence sur (template_key + payload->enrollment_id + scheduled date).
 * Degrés : J-5 préventif, J+1 formel, J+7 avertissement.
 */
export async function generateDueReminders(
  formData: FormData
): Promise<ActionResult<{ queued: number; skipped: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const todayISO = new Date().toISOString().slice(0, 10)
  const inFive = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)

  const { data: balances, error } = await admin
    .from("v_student_balances")
    .select("enrollment_id, first_name, last_name, guardian_name, guardian_phone, balance, next_due_date, next_due_amount")
    .eq("school_id", schoolId)
    .gt("balance", 0)

  if (error) return { error: error.message }

  type Row = {
    enrollment_id: string
    first_name: string
    last_name: string
    guardian_name: string | null
    guardian_phone: string | null
    balance: number
    next_due_date: string | null
    next_due_amount: number | null
  }
  const rows = (balances ?? []) as Row[]

  const toQueue: Array<{
    school_id: string
    recipient_phone: string
    channel: string
    template_key: string
    payload: Record<string, unknown>
  }> = []
  let skipped = 0

  for (const r of rows) {
    if (!r.guardian_phone || !r.next_due_date) continue
    const amount = r.next_due_amount ?? r.balance
    const base = {
      student: `${r.first_name} ${r.last_name}`,
      guardian: r.guardian_name,
      due_date: r.next_due_date,
      amount,
      balance: r.balance,
    }

    let templateKey: string | null = null
    if (r.next_due_date === todayISO) templateKey = "fee_reminder_j0"
    else if (r.next_due_date <= inFive && r.next_due_date > todayISO) templateKey = "fee_reminder_j5"
    else if (r.next_due_date < todayISO && r.next_due_date >= yesterday) templateKey = "fee_reminder_j1"
    else if (r.next_due_date < weekAgo) templateKey = "fee_reminder_j7"

    if (!templateKey) {
      skipped += 1
      continue
    }

    // Anti-doublon : une relance du même palier pour la même échéance n'est
    // jamais recréée (payload->>'enrollment_id' + template + due_date).
    const { data: existing } = await admin
      .from("notification_outbox")
      .select("id")
      .eq("school_id", schoolId)
      .eq("template_key", templateKey)
      .eq("payload->>enrollment_id", r.enrollment_id)
      .eq("payload->>due_date", r.next_due_date)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) {
      skipped += 1
      continue
    }

    toQueue.push({
      school_id: schoolId,
      recipient_phone: r.guardian_phone,
      channel: "whatsapp",
      template_key: templateKey,
      payload: { enrollment_id: r.enrollment_id, ...base },
    })
  }

  if (toQueue.length > 0) {
    const { error: insertError } = await admin.from("notification_outbox").insert(toQueue)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath("/dashboard/direction/finance/reminders")
  return { data: { queued: toQueue.length, skipped } }
}
