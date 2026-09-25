"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { PRICING_ROLES } from "@/utils/supabase/roles"
import { generateFeeItemsForEnrollment } from "@/lib/finance-fees"
import {
  buildPageResult,
  pageRange,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

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
 * Soldes des inscriptions de l'année : attendu / payé / reste, prochaine
 * échéance. Source unique des impayés (direction) et du guichet (solde affiché
 * AVANT l'encaissement).
 *
 * S2 : `opts` pagine la lecture en base (`.range()` + `count` exact) et la
 * réponse porte `total` / `totalPages`. Sans `opts`, la liste complète est
 * renvoyée : le guichet en a besoin pour afficher le solde de n'importe quelle
 * inscription, la construction de la carte ne tolerate pas une page.
 */
export async function getStudentBalances(
  schoolId: string,
  academicYearId?: string,
  opts?: PageRequestOptions
) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) {
    // Contrat uniforme : même en cas de refus, les métadonnées de page sont là.
    return {
      ...denial(guard.reason, []),
      ...buildPageResult<StudentBalance>([], 0, request),
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = admin
    .from("v_student_balances")
    .select("*", { count: "exact" })
    .eq("school_id", guard.context.schoolId)
    .order("balance", { ascending: false })

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId)
  }

  if (request.wantsPagination) {
    const { from, to } = pageRange(request)
    query = query.range(from, to)
  }

  const { data, error, count } = await query
  if (error) {
    return {
      error: error.message,
      ...buildPageResult<StudentBalance>([], 0, request),
    }
  }
  return buildPageResult((data ?? []) as StudentBalance[], count, request)
}

/** KPI du tableau de bord finance : tout en une seule lecture de la vue. */
export async function getFinanceOverview(schoolId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, null)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
