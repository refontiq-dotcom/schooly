"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { PRICING_ROLES } from "@/utils/supabase/roles"
import { planSiblingDiscounts } from "@/lib/discounts"
import { parseForm } from "@/lib/schemas/parse-form"
import { manualDiscountSchema } from "@/lib/schemas/discount"
import { logServerEvent } from "@/lib/server-logger"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ RÉDUCTIONS ========================

type DiscountRow = { id: string; kind: string; label: string; amount: number; reason: string | null; created_at: string }

/** Lignes de réduction d'une inscription (audit des remises fratrie/bourse). */
export async function getEnrollmentDiscounts(schoolId: string, enrollmentId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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

  // P1-A : validation zod (uuid, entier strict, libellé borné avec défaut) —
  // remplace le `parseInt(...) || 0` qui rendait une saisie vide invalide de
  // façon opaque.
  const parsed = parseForm(manualDiscountSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const { enrollmentId, discountAmount: amount, discountLabel: label } = parsed.data

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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

  logServerEvent("info", "discount.applied", {
    schoolId,
    enrollmentId,
    requested: amount,
    applied,
  })

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
    process.env.SUPABASE_SECRET_KEY!
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

  if (!academicYearId) return { error: "Année académique requise." }

  // Le taux de remise fratrie n'est PAS imposé : toutes les écoles ne
  // pratiquent pas de remise fratrie, et celles qui en pratiquent choisissent
  // leur taux. Aucune valeur par défaut n'est donc appliquée en silence —
  // l'absence de taux explicite est une erreur, pas un « 10 % » implicite.
  const rateRaw = ((formData.get("rate") as string) || "").trim()
  if (!rateRaw) {
    return {
      error:
        "Indiquez le taux de remise fratrie appliqué par l'établissement (1 à 50 %). Aucun taux n'est appliqué par défaut.",
    }
  }

  const rateInput = Number.parseInt(rateRaw, 10)
  if (!Number.isFinite(rateInput) || rateInput < 1 || rateInput > 50) {
    return { error: "Le taux de remise fratrie doit être compris entre 1 % et 50 %." }
  }

  const rate = rateInput

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
