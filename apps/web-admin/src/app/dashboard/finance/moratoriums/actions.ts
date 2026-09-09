"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

function getSchoolId(userId: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single()
}

// ============================================ MORATOIRES ======================

export async function getMoratoriums(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

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
    .eq("school_id", schoolId)
    .order("requested_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createMoratorium(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const { data: roleData } = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

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

  if (!enrollment || enrollment.school_id !== roleData.school_id) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { error } = await admin.from("moratoriums").insert({
    school_id: roleData.school_id,
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

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

  const newStatus = action === "approve" ? "approved" : "rejected"

  const { error } = await admin
    .from("moratoriums")
    .update({
      status: newStatus,
      approved_amount: action === "approve" ? (approvedAmount || moratorium.requested_amount) : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", moratoriumId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}

// ============================================ RELANCES ========================

export async function getPaymentReminders(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const { data: roleData } = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

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

  if (!enrollment || enrollment.school_id !== roleData.school_id) {
    return { error: "Inscription introuvable ou accès non autorisé." }
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("phone")
    .eq("id", enrollment.guardian_id)
    .single()

  const { error } = await admin.from("payment_reminders").insert({
    school_id: roleData.school_id,
    enrollment_id: enrollmentId,
    reminder_type: reminderType,
    channel: channel,
    sent_by: user.id,
  })

  if (error) return { error: error.message }

  const notificationId = crypto.randomUUID()
  await admin.from("notification_outbox").insert({
    school_id: roleData.school_id,
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

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
    .eq("school_id", schoolId)
    .order("score", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function updateFamilyReliabilityScore(schoolId: string, guardianId: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: moratoriums } = await admin
    .from("moratoriums")
    .select("status")
    .eq("guardian_id", guardianId)
    .eq("school_id", schoolId)

  const totalMoratoriums = moratoriums?.length || 0
  const approvedMoratoriums = moratoriums?.filter(m => m.status === "approved").length || 0
  const rejectedMoratoriums = moratoriums?.filter(m => m.status === "rejected").length || 0

  const score = Math.max(0, Math.min(100, 100 - (rejectedMoratoriums * 10) - (totalMoratoriums * 2) + (approvedMoratoriums * 5)))

  const { error } = await admin
    .from("family_reliability_scores")
    .upsert({
      school_id: schoolId,
      guardian_id: guardianId,
      score,
      total_moratoriums: totalMoratoriums,
      approved_moratoriums: approvedMoratoriums,
      rejected_moratoriums: rejectedMoratoriums,
      last_updated: new Date().toISOString(),
    }, {
      onConflict: ["school_id", "guardian_id"]
    })

  if (error) return { error: error.message }
  return { data: { score } }
}
