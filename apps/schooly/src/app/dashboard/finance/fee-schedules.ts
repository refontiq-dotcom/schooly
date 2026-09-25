"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { PRICING_ROLES } from "@/utils/supabase/roles"
import { parseForm } from "@/lib/schemas/parse-form"
import { feeScheduleSchema } from "@/lib/schemas/finance"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

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
    process.env.SUPABASE_SECRET_KEY!
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

  // P1-A : validation zod (uuid, montant FCFA strict, libellé borné) —
  // remplace le `parseInt(...) || 0` qui transformait une saisie vide en
  // montant nul détecté après coup par un message générique.
  const parsed = parseForm(feeScheduleSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const { gradeLevelId, financialProfileId, amount, academicYearId, label } = parsed.data

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
