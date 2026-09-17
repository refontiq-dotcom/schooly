"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { DECISION_ROLES } from "@/utils/supabase/roles"
import { isValidMovementCode, normalizeMovementCode } from "@/lib/movements/code"

/**
 * Import d'un élève via un code de transfert Schooly (école d'accueil).
 *
 * La création de l'inscription et la consommation du code sont réalisées en
 * base, dans une transaction unique (`consume_student_movement`). L'école
 * d'accueil ne peut pas lire le dossier source : seule la direction de
 * l'établissement autorisé par la direction de départ peut importer.
 */

export type ImportOption = { id: string; label: string }

export async function getImportOptions(): Promise<{
  error?: string
  data?: { classes: ImportOption[]; years: ImportOption[] }
}> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const schoolId = guard.context.schoolId
  const [classes, years] = await Promise.all([
    db.from("classes").select("id,name").eq("school_id", schoolId).is("deleted_at", null).order("name"),
    db.from("academic_years").select("id,label").eq("school_id", schoolId).order("start_date", { ascending: false }),
  ])
  if (classes.error || years.error) {
    return { error: "Impossible de charger les classes et les années de votre établissement. Réessayez." }
  }
  return { data: {
    classes: (classes.data ?? []).map(row => ({ id: row.id as string, label: String(row.name ?? "") })),
    years: (years.data ?? []).map(row => ({ id: row.id as string, label: String(row.label ?? "") })),
  } }
}

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function importMovement(form: FormData): Promise<{ error?: string; data?: { enrollmentId: string } }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const code = normalizeMovementCode(String(form.get("trackingCode") ?? ""))
  const classId = String(form.get("classId") ?? "").trim()
  const academicYearId = String(form.get("academicYearId") ?? "").trim()
  if (!isValidMovementCode(code)) {
    return { error: "Code invalide : vérifiez les 8 caractères de la fiche de transfert." }
  }
  if (code.startsWith("ORT")) {
    return { error: "L’import d’une orientation officielle n’est pas encore disponible." }
  }
  if (!UUID.test(classId) || !UUID.test(academicYearId)) {
    return { error: "Sélectionnez la classe et l’année scolaire d’accueil." }
  }
  const { data, error } = await db.rpc("consume_student_movement", {
    p_tracking_code: code,
    p_school_to: guard.context.schoolId,
    p_class_id: classId,
    p_academic_year_id: academicYearId,
  })
  if (error) {
    if (["42883", "PGRST202"].includes(error.code ?? "")) {
      return { error: "L’import par transfert n’est pas encore installé sur cette base. Contactez l’administrateur." }
    }
    if (error.code === "23505") {
      return { error: "Ce code a déjà été utilisé : aucune seconde inscription n’a été créée." }
    }
    return { error: error.message }
  }
  const enrollmentId = typeof data === "string" ? data : null
  if (!enrollmentId) {
    return { error: "Import non confirmé. Vérifiez l’état de l’élève avant de réessayer." }
  }
  revalidatePath("/dashboard/admissions/import")
  return { data: { enrollmentId } }
}