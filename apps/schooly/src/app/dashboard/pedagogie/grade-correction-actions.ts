"use server"

import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { TEACHING_ROLES } from "@/utils/supabase/roles"
import { revalidatePath } from "next/cache"

export type GradeCorrection = {
  id: string; revision: number; old_value: number | null; new_value: number | null
  old_status: string; new_status: string; old_comment: string | null; new_comment: string | null
  reason: string; corrected_by: string; corrected_at: string
}

export type GradeChangeRequest = {
  id: string; grade_id: string; requested_by: string; requested_at: string
  old_revision: number; old_value: number | null; old_status: string; old_comment: string | null
  new_value: number | null; new_status: string; new_comment: string | null
  reason: string; status: string
}

export async function correctGradeEntry(form: FormData): Promise<{ error?: string }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ["professeur"] })
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
  revalidatePath("/dashboard/pedagogie/grades")
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

export async function requestGradeChange(form: FormData): Promise<{ error?: string }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ["informatique"] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const text = (key: string) => String(form.get(key) ?? "").trim()
  const status = text("newStatus")
  const raw = text("newValue")
  const value = status === "excused" ? null : raw === "" ? NaN : Number(raw)
  const reason = text("reason")
  if (!text("gradeId") || !["graded", "excused"].includes(status) || !reason || reason.length > 2000 ||
    (status === "excused" && raw !== "") || (status === "graded" && (!Number.isFinite(value) || value < 0))) {
    return { error: "Note, statut et motif valides requis." }
  }
  const { error } = await (db as any).rpc("request_evaluation_grade_change", {
    p_school_id: guard.context.schoolId, p_grade_id: text("gradeId"),
    p_value: value, p_status: status, p_comment: text("newComment"), p_reason: reason,
  })
  if (error) return { error: error.message }
  revalidatePath("/dashboard/informatique/grade-change-requests")
  revalidatePath("/dashboard/pedagogie/grades")
  return {}
}

export async function getGradesForIT(): Promise<{ error?: string; data?: Array<{
  id: string; revision: number; label: string; value: number | null; max_value: number;
  absence_status: string; student: string; subject: string
}> }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ["informatique"] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await db.from("grade_entries")
    .select("id,revision,label,value,max_value,absence_status,enrollments(students(first_name,last_name)),subjects(name)")
    .eq("school_id", guard.context.schoolId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(500)
  if (error) return { error: error.message }
  return {
    data: (data ?? []).map((row: any) => ({
      id: row.id, revision: row.revision, label: row.label ?? "Évaluation",
      value: row.value, max_value: row.max_value, absence_status: row.absence_status,
      student: [row.enrollments?.students?.last_name, row.enrollments?.students?.first_name].filter(Boolean).join(" "),
      subject: row.subjects?.name ?? "Matière",
    }))
  }
}

export async function listPendingGradeChangeRequests(): Promise<{ error?: string; data?: GradeChangeRequest[] }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: [...TEACHING_ROLES, "informatique", "direction", "super_admin"] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await (db as any).rpc("list_pending_grade_change_requests", { p_school_id: guard.context.schoolId })
  return error ? { error: error.message } : { data: (data ?? []) as GradeChangeRequest[] }
}

export async function decideGradeChange(form: FormData): Promise<{ error?: string }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const requestId = String(form.get("requestId") ?? "").trim()
  const decision = String(form.get("decision") ?? "").trim()
  const decisionReason = String(form.get("decisionReason") ?? "").trim()
  if (!requestId || !["approve", "reject"].includes(decision) || decisionReason.length > 2000) {
    return { error: "Décision valide requise." }
  }
  const { error } = await (db as any).rpc("decide_evaluation_grade_change", {
    p_request_id: requestId, p_approve: decision === "approve", p_decision_reason: decisionReason || null,
  })
  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie/grades")
  revalidatePath("/dashboard/informatique/grade-change-requests")
  return {}
}
