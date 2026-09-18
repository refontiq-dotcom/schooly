// ============================================================================
// lib/finance-fees.ts — Génération du « dû » d'une inscription (serveur).
//
// Appelé à la création de chaque inscription (validatePreEnrollment et
// completeCounterEnrollment) : lit la grille tarifaire de l'école, découpe le
// montant selon le plan (annuel / trimestriel) via planFeeItems, et insère les
// tranches dans student_fee_items.
//
// Best effort volontaire : si aucun tarif ne correspond (grille non
// configurée), la fonction ne fait RIEN et renvoie no_fee_schedule —
// l'inscription ne doit jamais échouer parce que la grille est vide. La
// direction rattrape via « Générer les échéanciers manquants » du dashboard
// finance.
// ============================================================================

import { planFeeItems, type FeePlan } from "@/lib/finance"
import type { SupabaseClient } from "@supabase/supabase-js"

export type GenerateFeeItemsResult =
  | { ok: true; items: number; amount: number }
  | { ok: false; reason: "no_fee_schedule" | "no_academic_year" | "error"; message?: string }

export async function generateFeeItemsForEnrollment(
  admin: SupabaseClient,
  args: {
    schoolId: string
    enrollmentId: string
    academicYearId: string
    gradeLevelId: string
    financialProfileId?: string | null
    plan?: FeePlan
  }
): Promise<GenerateFeeItemsResult> {
  const { schoolId, enrollmentId, academicYearId, gradeLevelId, financialProfileId } = args
  const plan: FeePlan = args.plan ?? "annuel"

  const { data: year } = await admin
    .from("academic_years")
    .select("label, start_date, end_date")
    .eq("id", academicYearId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!year?.start_date || !year?.end_date) {
    return { ok: false, reason: "no_academic_year" }
  }

  // Tarif : profil exact d'abord, sinon « Standard » (profil NULL de la grille).
  const { data: fees } = await admin
    .from("fee_schedules")
    .select("amount")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("grade_level_id", gradeLevelId)
    .is("deleted_at", null)

  const feeList = fees ?? []
  const matched =
    feeList.find(
      (f: { amount: number } & Record<string, unknown>) =>
        financialProfileId && f.financial_profile_id === financialProfileId
    ) ??
    feeList.find(
      (f: { amount: number } & Record<string, unknown>) => f.financial_profile_id === null
    ) ??
    feeList[0]

  if (!matched?.amount) {
    return { ok: false, reason: "no_fee_schedule" }
  }

  const items = planFeeItems({
    totalAmount: matched.amount,
    plan,
    yearStart: year.start_date,
    yearEnd: year.end_date,
    yearLabel: year.label ?? null,
  })

  if (items.length === 0) {
    return { ok: false, reason: "no_fee_schedule" }
  }

  const { error } = await admin.from("student_fee_items").insert(
    items.map((item) => ({
      school_id: schoolId,
      enrollment_id: enrollmentId,
      academic_year_id: academicYearId,
      label: item.label,
      amount: item.amount,
      due_date: item.dueDate,
      position: item.position,
      source: "auto",
    }))
  )

  if (error) {
    return { ok: false, reason: "error", message: error.message }
  }

  return { ok: true, items: items.length, amount: matched.amount }
}
