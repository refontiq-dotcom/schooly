"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { PRICING_ROLES } from "@/utils/supabase/roles"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

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
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
