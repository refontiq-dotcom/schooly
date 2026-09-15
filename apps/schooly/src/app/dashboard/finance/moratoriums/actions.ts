"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import { denial, requireSchoolRole } from "@/utils/supabase/require-role"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

/** Moratoires, relances et scoring : fonctions financières sensibles. */
const MORATORIUM_ROLES = ["direction", "compta", "super_admin"] as const

/** Relances de paiement : secrétariat inclus (envoi opérationnel). */
const REMINDER_ROLES = ["direction", "compta", "secretariat", "super_admin"] as const

// ============================================ MORATOIRES ======================

export async function getMoratoriums(schoolId: string) {
  const supabase = await createClient()

  // Garde cross-tenant : le school_id client est refusé s'il diffère de
  // l'école de la session (même IDOR que le reste du module finance).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("moratoriums")
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
    .order("requested_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createMoratorium(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Demande de moratoire sur une inscription : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const reason = formData.get("reason") as string
  const requestedAmount = parseInt(formData.get("requestedAmount") as string || "0")
  const dueDate = formData.get("dueDate") as string

  if (!enrollmentId || !reason || !requestedAmount || !dueDate) {
    return { error: "Tous les champs sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("school_id, guardian_id")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment || enrollment.school_id !== schoolId) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { error } = await admin.from("moratoriums").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    guardian_id: enrollment.guardian_id,
    reason,
    requested_amount: requestedAmount,
    due_date: dueDate,
    status: "pending",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

export async function reviewMoratorium(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Décision sur un moratoire (argent) : direction / compta uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const moratoriumId = formData.get("moratoriumId") as string
  const action = formData.get("action") as string
  const approvedAmount = formData.get("approvedAmount") ? parseInt(formData.get("approvedAmount") as string) : null

  if (!moratoriumId || !action) {
    return { error: "ID de moratoire et action requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: moratorium } = await admin
    .from("moratoriums")
    .select("*")
    .eq("id", moratoriumId)
    .single()

  if (!moratorium) return { error: "Moratoire introuvable." }
  // Cloisonnement : un moratoire d'une autre école est traité comme
  // introuvable (pas de divulgation d'existence) — même classe d'IDOR
  // que le P1-3 du socle, corrigée dans le cadre de l'audit Finance.
  if (moratorium.school_id !== schoolId) {
    return { error: "Moratoire introuvable." }
  }

  const newStatus = action === "approve" ? "approved" : "rejected"

  const { error } = await admin
    .from("moratoriums")
    .update({
      status: newStatus,
      approved_amount: action === "approve" ? (approvedAmount || moratorium.requested_amount) : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", moratoriumId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ RELANCES ========================

export async function getPaymentReminders(schoolId: string) {
  const supabase = await createClient()

  // Garde cross-tenant : lecture des relances de sa propre école uniquement.
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("payment_reminders")
    .select(`
      *,
      enrollments (
        matricule,
        students ( first_name, last_name ),
        guardians ( full_name, phone )
      )
    `)
    .eq("school_id", schoolId)
    .order("sent_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function sendPaymentReminder(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Envoi d'une relance : direction / compta / secrétariat uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REMINDER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const reminderType = formData.get("reminderType") as string
  const channel = formData.get("channel") as string

  if (!enrollmentId || !reminderType || !channel) {
    return { error: "Inscription, type et canal requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("school_id, guardian_id")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment || enrollment.school_id !== schoolId) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("phone")
    .eq("id", enrollment.guardian_id)
    .single()

  const { error } = await admin.from("payment_reminders").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    reminder_type: reminderType,
    channel: channel,
    sent_by: userId,
  })

  if (error) return { error: error.message }

  await admin.from("notification_outbox").insert({
    school_id: schoolId,
    recipient_phone: guardian?.phone || "",
    channel: channel,
    template_key: `reminder_${reminderType}`,
    payload: {
      enrollment_id: enrollmentId,
      reminder_type: reminderType,
    },
  })

  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ SCORING FIABILITÉ ================

export async function getFamilyReliabilityScores(schoolId: string) {
  const supabase = await createClient()

  // Garde cross-tenant : scoring des familles de sa propre école uniquement.
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("family_reliability_scores")
    .select(`
      *,
      guardians ( full_name, phone )
    `)
    .eq("school_id", guard.context.schoolId)
    .order("score", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function updateFamilyReliabilityScore(schoolId: string, guardianId: string) {
  const supabase = await createClient()

  // Recalcul du score : direction / compta uniquement, sur sa propre école.
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...MORATORIUM_ROLES],
    requestedSchoolId: schoolId,
  })
  if (!guard.ok) return denial(guard.reason, { score: null as number | null })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: moratoriums } = await admin
    .from("moratoriums")
    .select("status")
    .eq("guardian_id", guardianId)
    .eq("school_id", guard.context.schoolId)

  const totalMoratoriums = moratoriums?.length || 0
  const approvedMoratoriums = moratoriums?.filter(m => m.status === "approved").length || 0
  const rejectedMoratoriums = moratoriums?.filter(m => m.status === "rejected").length || 0

  const score = Math.max(0, Math.min(100, 100 - (rejectedMoratoriums * 10) - (totalMoratoriums * 2) + (approvedMoratoriums * 5)))

  const { error } = await admin
    .from("family_reliability_scores")
    .upsert({
      school_id: guard.context.schoolId,
      guardian_id: guardianId,
      score,
      total_moratoriums: totalMoratoriums,
      approved_moratoriums: approvedMoratoriums,
      rejected_moratoriums: rejectedMoratoriums,
      last_updated: new Date().toISOString(),
    }, {
      onConflict: "school_id, guardian_id"
    })

  if (error) return { error: error.message }
  return { data: { score } }
}
