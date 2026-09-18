"use server"

import { createClient } from "@/utils/supabase/server"
import { MORATORIUM_ROLES, REMINDER_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import { denial, requireSchoolRole } from "@/utils/supabase/require-role"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

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

export async function getMoratoriumContext(enrollmentId: string): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: enrollment } = await admin.from("enrollments")
    .select("id, school_id, guardian_id, fee_expected, fee_paid, fee_balance, fee_status")
    .eq("id", enrollmentId).single()
  if (!enrollment || enrollment.school_id !== guard.context.schoolId) return { error: "Inscription introuvable ou accès non autorisé." }
  const { data: active } = await admin.from("moratoriums")
    .select("id, status, requested_amount, approved_amount, due_date")
    .eq("enrollment_id", enrollmentId).is("deleted_at", null)
    .in("status", ["pending","approved"]).limit(1)
  const { data: history } = await admin.from("moratoriums")
    .select("id, status, requested_amount, approved_amount, due_date, requested_at")
    .eq("enrollment_id", enrollmentId).is("deleted_at", null)
    .order("requested_at", { ascending: false }).limit(5)
  return { data: { enrollment, active: active?.[0] ?? null, history: history ?? [] } }
}

export async function createMoratorium(formData: FormData): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context
  const enrollmentId = String(formData.get("enrollmentId") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()
  const requestedAmount = Number(formData.get("requestedAmount") ?? 0)
  const dueDate = String(formData.get("dueDate") ?? "")
  if (!enrollmentId || reason.length < 5 || !Number.isInteger(requestedAmount) || requestedAmount <= 0 || !dueDate) {
    return { error: "Élève, motif, montant et date limite sont requis." }
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: enrollment } = await admin.from("enrollments")
    .select("school_id, guardian_id, fee_balance").eq("id", enrollmentId).single()
  if (!enrollment || enrollment.school_id !== schoolId) return { error: "Inscription introuvable ou accès non autorisé." }
  const balance = Number(enrollment.fee_balance ?? 0)
  if (balance <= 0) return { error: "Aucun solde à rééchelonner pour cette inscription." }
  if (requestedAmount > balance) return { error: `Le montant demandé ne peut pas dépasser le solde restant de ${balance.toLocaleString("fr-FR")} FCFA.` }
  if (new Date(dueDate) <= new Date()) return { error: "La date limite doit être future." }
  const { data: existing } = await admin.from("moratoriums").select("id").eq("enrollment_id", enrollmentId)
    .is("deleted_at", null).in("status", ["pending","approved"]).limit(1)
  if (existing?.length) return { error: "Un moratoire actif ou en attente existe déjà pour cet élève." }
  const { data: created, error } = await admin.from("moratoriums").insert({
    school_id: schoolId, enrollment_id: enrollmentId, guardian_id: enrollment.guardian_id,
    reason, requested_amount: requestedAmount, due_date: dueDate, status: "pending",
  }).select("id").single()
  if (error) return { error: error.message }
  revalidatePath("/dashboard/direction/finance")
  revalidatePath("/dashboard/direction/finance/moratoriums")
  return { data: created }
}

export async function reviewMoratorium(formData: FormData): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context
  const moratoriumId = String(formData.get("moratoriumId") ?? "")
  const action = String(formData.get("action") ?? "")
  const approvedAmount = Number(formData.get("approvedAmount") ?? 0)
  const installmentCount = Number(formData.get("installmentCount") ?? 0)
  if (!moratoriumId || !["approve","reject"].includes(action)) return { error: "Décision invalide." }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: m } = await admin.from("moratoriums").select("*").eq("id", moratoriumId).single()
  if (!m || m.school_id !== schoolId || m.status !== "pending") return { error: "Moratoire introuvable ou déjà traité." }
  if (action === "reject") {
    const { error } = await admin.from("moratoriums").update({ status:"rejected", approved_amount:null, reviewed_at:new Date().toISOString(), reviewed_by:userId }).eq("id", moratoriumId)
    if (error) return { error:error.message }
    revalidatePath("/dashboard/direction/finance"); revalidatePath("/dashboard/direction/finance/moratoriums")
    return { data:{ nextAction:"relance_or_payment_plan" } }
  }
  const amount = approvedAmount > 0 ? approvedAmount : Number(m.requested_amount)
  if (!Number.isInteger(amount) || amount <= 0 || amount > Number(m.requested_amount)) return { error: "Le montant approuvé doit être positif et ne pas dépasser le montant demandé." }
  const count = Number.isInteger(installmentCount) && installmentCount >= 1 && installmentCount <= 12 ? installmentCount : 3
  const endDate = new Date(String(m.due_date))
  const now = new Date()
  const start = now > new Date() ? now : now
  const rows = Array.from({length:count},(_,i)=> {
    const d = new Date(start)
    d.setMonth(d.getMonth()+i+1)
    if (d > endDate) d.setTime(endDate.getTime())
    return { moratorium_id: moratoriumId, installment_no:i+1, due_date:d.toISOString().slice(0,10), amount:Math.floor(amount/count)+(i < amount%count ? 1:0) }
  })
  const { error: updateError } = await admin.from("moratoriums").update({ status:"approved", approved_amount:amount, reviewed_at:new Date().toISOString(), reviewed_by:userId }).eq("id",moratoriumId)
  if (updateError) return { error:updateError.message }
  const { error: scheduleError } = await admin.from("moratorium_installments").insert(rows)
  if (scheduleError) return { error:scheduleError.message }
  revalidatePath("/dashboard/direction/finance"); revalidatePath("/dashboard/direction/finance/moratoriums")
  return { data:{ nextAction:"monitor_installments", installmentCount:count } }
}

export async function getMoratoriumInstallments(moratoriumId: string) {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...MORATORIUM_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data:m } = await admin.from("moratoriums").select("school_id").eq("id",moratoriumId).single()
  if (!m || m.school_id !== guard.context.schoolId) return { error:"Moratoire introuvable.", data:[] }
  const { data, error } = await admin.from("moratorium_installments").select("*").eq("moratorium_id",moratoriumId).order("installment_no")
  if (error) return { error:error.message, data:[] }
  return { data:data ?? [] }
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
