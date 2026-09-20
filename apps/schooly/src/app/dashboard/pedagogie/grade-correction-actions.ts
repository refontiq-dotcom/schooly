"use server"

import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { TEACHING_ROLES } from "@/utils/supabase/roles"
import { revalidateGrades } from "./grades/_lib/revalidate"

export type GradeCorrection = {
  id: string; revision: number; old_value: number | null; new_value: number | null
  old_status: string; new_status: string; old_comment: string | null; new_comment: string | null
  reason: string; corrected_by: string; corrected_at: string
}

export async function correctGradeEntry(form: FormData): Promise<{ error?: string }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const text = (key: string) => String(form.get(key) ?? "").trim()
  const revision = Number(text("revision")), status = text("absenceStatus"), reason = text("reason")
  const raw = text("value"), value = status === "excused" ? null : raw === "" ? NaN : Number(raw)
  if (!text("gradeId") || !Number.isSafeInteger(revision) || revision < 1 || !reason || reason.length > 2000 ||
    !["graded", "excused"].includes(status) || (status === "excused" && raw !== "") ||
    (value !== null && (!Number.isFinite(value) || value < 0))) return { error: "Note, statut, version et motif valides requis." }
  const { error } = await db.rpc("correct_evaluation_grade", {
    p_school_id: guard.context.schoolId, p_grade_id: text("gradeId"), p_revision: revision,
    p_value: value, p_status: status, p_comment: text("comment"), p_reason: reason,
  })
  if (error) return { error: error.message }
  // Une correction touche le module entier : la saisie, l'aperçu annuel et le
  // hub doivent tous être invalidés, pas seulement l'ancienne URL unique.
  revalidateGrades()
  return {}
}

export async function getGradeCorrections(gradeId: string): Promise<{ error?: string; data?: GradeCorrection[] }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await db.from("grade_corrections")
    .select("id,revision,old_value,new_value,old_status,new_status,old_comment,new_comment,reason,corrected_by,corrected_at")
    .eq("school_id", guard.context.schoolId).eq("grade_id", gradeId).order("revision", { ascending: false })
  return error ? { error: error.message } : { data: data as GradeCorrection[] }
}
