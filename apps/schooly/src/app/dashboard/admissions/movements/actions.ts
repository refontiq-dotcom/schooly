"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { ADMISSIONS_ROLES, DECISION_ROLES } from "@/utils/supabase/roles"

export type MovementEnrollment = { id: string; label: string; matricule: string | null }
export type MovementRequest = {
  id: string; enrollment_id: string; kind: "TRF" | "ORT"; reason: string
  decision_reference: string | null; tracking_code: string; created_at: string
}

export type MovementActivation = {
  request_id: string
  activated_at: string
  expires_at: string
  expired: boolean
}
export type ActivationResult = {
  tracking_code: string; status: "ACTIVE" | "EXPIRED"; expires_at: string
}

type EnrollmentRow = {
  id: string; matricule: string | null
  students: { first_name: string; last_name: string } | null
  academic_years: { label: string } | null
  classes: { name: string } | null
}

export async function getMovementOverview(): Promise<{
  error?: string
  data?: { enrollments: MovementEnrollment[]; requests: MovementRequest[] }
}> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ADMISSIONS_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const schoolId = guard.context.schoolId
  const [enrollments, requests] = await Promise.all([
    db.from("enrollments")
      .select("id,matricule,students!inner(first_name,last_name),academic_years(label),classes(name)")
      .eq("school_id", schoolId).eq("status", "active").is("deleted_at", null)
      .eq("students.school_id", schoolId).is("students.deleted_at", null)
      .order("created_at", { ascending: false }),
    db.from("student_movement_requests")
      .select("id,enrollment_id,kind,reason,decision_reference,tracking_code,created_at")
      .eq("school_id", schoolId).order("created_at", { ascending: false }),
  ])
  const error = enrollments.error ?? requests.error
  if (error) return { error: ["42P01", "PGRST205"].includes(error.code)
    ? "La préparation TRF/ORT n’est pas encore installée sur cette base. Contactez l’administrateur."
    : "Impossible de charger les demandes. Réessayez ou contactez l’administrateur." }
  return { data: {
    enrollments: ((enrollments.data ?? []) as unknown as EnrollmentRow[]).map(e => ({
      id: e.id, matricule: e.matricule,
      label: `${e.students?.last_name ?? ""} ${e.students?.first_name ?? ""} — ${e.academic_years?.label ?? "Année non renseignée"} — ${e.classes?.name ?? "Sans classe"}`.trim(),
    })),
    requests: (requests.data ?? []) as MovementRequest[],
  } }
}

export async function getMovementActivations(): Promise<{
  canActivate: boolean; data?: MovementActivation[]; error?: string
}> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { canActivate: false }
  const { data, error } = await db.from("student_movement_activations")
    .select("request_id,activated_at,expires_at").eq("school_id", guard.context.schoolId)
  if (error) return { canActivate: false, error: ["42P01", "PGRST205"].includes(error.code)
    ? "L’activation TRF n’est pas encore installée sur cette base. Contactez l’administrateur."
    : "Impossible de charger les activations. Réessayez." }
  const now = Date.now()
  return {
    canActivate: true,
    data: ((data ?? []) as MovementActivation[]).map((activation) => ({
      ...activation,
      expired: new Date(activation.expires_at).getTime() <= now,
    })),
  }
}

export async function activateMovement(form: FormData): Promise<{ error?: string; data?: ActivationResult }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const requestId = String(form.get("requestId") ?? "").trim()
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)) {
    return { error: "Demande invalide." }
  }
  const { data, error } = await db.rpc("activate_student_movement", {
    p_school_id: guard.context.schoolId, p_request_id: requestId,
  })
  if (error) return { error: ["42883", "PGRST202"].includes(error.code)
    ? "L’activation TRF n’est pas encore installée sur cette base. Contactez l’administrateur."
    : error.message }
  const activation = (data as ActivationResult[] | null)?.[0]
  if (!activation) return { error: "Aucun résultat d’activation reçu. Rechargez la page avant de réessayer." }
  revalidatePath("/dashboard/admissions/movements")
  return { data: activation }
}

export async function prepareMovement(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: ADMISSIONS_ROLES })
  if (!guard.ok) return denial(guard.reason, null)
  const text = (key: string) => String(form.get(key) ?? "").trim()
  const kind = text("kind"), reason = text("reason"), enrollmentId = text("enrollmentId")
  if (!['TRF', 'ORT'].includes(kind) || reason.length < 3 || reason.length > 500 ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(enrollmentId)) {
    return { error: "Vérifiez l’inscription, le type et le motif (3 à 500 caractères)." }
  }
  const decision = text("decisionReference"), authority = text("issuingAuthority"), scholarship = text("scholarshipStatus")
  if (kind === 'ORT' && (!decision || decision.length > 150 || !authority || authority.length > 150 ||
      !['boursier', 'non_boursier', 'inconnu'].includes(scholarship))) {
    return { error: "Référence, autorité émettrice et statut de bourse requis pour préparer ORT." }
  }
  const { error } = await db.from("student_movement_requests").insert({
    school_id: guard.context.schoolId, enrollment_id: enrollmentId, kind, reason,
    decision_reference: kind === 'ORT' ? decision : null,
    issuing_authority: kind === 'ORT' ? authority : null,
    scholarship_status: kind === 'ORT' ? scholarship : null,
  })
  if (error) return { error: error.code === '23505' ? "Une demande existe déjà pour cette inscription." : error.message }
  revalidatePath("/dashboard/admissions/movements")
  return {}
}
