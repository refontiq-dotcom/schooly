"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const getAdmin = () => createAdminClient(ADMIN_URL, ADMIN_KEY)

// ─── Contexte utilisateur ─────────────────────────────────────────────────

export async function getBillingContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("NOT_AUTHENTICATED")

  const { data: role } = await supabase
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "secretariat", "compta", "caisse", "super_admin"])
    .limit(1)
    .maybeSingle()

  if (!role) throw new Error("UNAUTHORIZED")

  const { data: school } = await getAdmin()
    .from("schools")
    .select("id, name, city")
    .eq("id", role.school_id)
    .single()

  return {
    userId: user.id,
    schoolId: role.school_id,
    roleCode: role.role_code,
    isSuperAdmin: role.role_code === "super_admin",
    school: school as { id: string; name: string; city: string | null } | null,
  }
}

// ─── Config billing Schooly ──────────────────────────────────────────────

export async function getSchoolyConfig() {
  const admin = getAdmin()
  const { data } = await admin
    .from("billing_configs")
    .select("event_amount, event_types")
    .eq("product_id", "schooly")
    .eq("is_active", true)
    .single()

  return {
    eventAmount: (data?.event_amount as number) || 1000,
    eventTypes: (data?.event_types as string[]) || ["enrollment_confirmed"],
  }
}

// ─── Résumé facturation établissement ────────────────────────────────────
// (durcissement P1-2 : le schoolId provient du contexte, jamais du client)

export async function getSchoolBillingSummary() {
  const { schoolId } = await getBillingContext()
  const admin = getAdmin()
  const config = await getSchoolyConfig()

  const { count: activeEnrollments } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active")
    .is("deleted_at", null)

  const { data: requests } = await admin
    .from("subscription_payment_requests")
    .select("id, amount, status, created_at")
    .eq("product_id", "schooly")
    .eq("tenant_id", schoolId)
    .order("created_at", { ascending: false })

  const totalEvents = activeEnrollments ?? 0
  const pending = (requests ?? []).filter((r) => r.status === "pending")
  const validated = (requests ?? []).filter((r) => r.status === "validated")
  const pendingSum = pending.reduce((s, r) => s + (r.amount || 0), 0)
  const validatedSum = validated.reduce((s, r) => s + (r.amount || 0), 0)

  const billedUnits = Math.round(pendingSum / config.eventAmount) +
    Math.round(validatedSum / config.eventAmount)
  const remainingEvents = Math.max(0, totalEvents - billedUnits)
  const expectedAmount = remainingEvents * config.eventAmount

  return {
    eventAmount: config.eventAmount,
    totalEvents,
    remainingEvents,
    expectedAmount,
    pendingRequests: pending,
    pendingSum,
    validatedSum,
    totalRequests: (requests ?? []).length,
  }
}

// ─── Créer une demande de versement ───────────────────────────────────────

export async function createSubscriptionPaymentRequest(
  formData: FormData,
): Promise<ActionResult<{ schoolId: string; amount: number }>> {
  const { userId, schoolId } = await getBillingContext().catch(() => {
    throw new Error("NOT_AUTHENTICATED")
  })

  const amount = parseInt((formData.get("amount") as string) || "0", 10)
  const senderPhone = ((formData.get("senderPhone") as string) || "").trim()
  const notes = ((formData.get("notes") as string | null) || "").trim() || null

  if (amount <= 0) return { error: "Montant invalide." }
  if (!senderPhone) return { error: "Numéro Wave requis." }
  if (!/^(0[1-9]\d{8}|\+225\s?0[1-9]\d{8})$/.test(senderPhone.replace(/\s/g, ""))) {
    return { error: "Format invalide. Ex: 07xxxxxxxx ou +225 07xxxxxxxx" }
  }

  const admin = getAdmin()
  const { error } = await admin.from("subscription_payment_requests").insert({
    product_id: "schooly",
    tenant_id: schoolId,
    tier_id: "school_event_based",
    amount,
    status: "pending",
    requested_by: userId,
    sender_phone: senderPhone,
    payment_provider: "wave",
    notes,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "Une demande est déjà en attente pour cet établissement." }
    }
    return { error: "Erreur lors de la création de la demande." }
  }

  revalidatePath("/dashboard/billing")
  return { data: { schoolId, amount } }
}

// ─── Demandes en attente (établissement ou super admin) ───────────────────

export async function getMyPaymentRequests(): Promise<ActionResult<Array<{
  id: string
  amount: number
  status: string
  sender_phone: string
  created_at: string
  tenant_name?: string
}>>> {
  const ctx = await getBillingContext().catch(() => null)
  if (!ctx) return { error: "Non authentifié.", data: [] }

  const admin = getAdmin()
  let query = admin
    .from("subscription_payment_requests")
    .select("id, amount, status, sender_phone, created_at, tenant_id")
    .eq("product_id", "schooly")
    .order("created_at", { ascending: false })

  if (!ctx.isSuperAdmin && ctx.schoolId) {
    query = query.eq("tenant_id", ctx.schoolId)
  }

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }

  return { data: data ?? [] }
}

// ─── Valider une demande (Super Admin) ────────────────────────────────────

export async function validatePaymentRequest(requestId: string): Promise<ActionResult> {
  const { userId } = await getBillingContext().catch(() => {
    throw new Error("NOT_AUTHENTICATED")
  })

  const admin = getAdmin()
  const { error } = await admin.rpc("validate_subscription_payment", {
    p_request_id: requestId,
    p_validator_id: userId,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/billing")
  return {}
}

// ─── Rejeter une demande (Super Admin) ────────────────────────────────────

export async function rejectPaymentRequest(requestId: string): Promise<ActionResult> {
  const { userId } = await getBillingContext().catch(() => {
    throw new Error("NOT_AUTHENTICATED")
  })

  const admin = getAdmin()
  const { error } = await admin.rpc("reject_subscription_payment", {
    p_request_id: requestId,
    p_validator_id: userId,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/billing")
  return {}
}

// ─── Toutes les demandes (Super Admin) ────────────────────────────────────

export async function getAllPendingRequests(): Promise<ActionResult<Array<{
  id: string
  amount: number
  status: string
  sender_phone: string
  created_at: string
  tenant_id: string
  tenant_name: string
}>>> {
  const admin = getAdmin()
  const { data, error } = await admin
    .from("subscription_payment_requests")
    .select(`
      id, amount, status, sender_phone, created_at, tenant_id,
      schools!inner (name)
    `)
    .eq("product_id", "schooly")
    .in("status", ["pending"])
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }

  const requests = (data ?? []).map((r: any) => ({
    id: r.id,
    amount: r.amount,
    status: r.status,
    sender_phone: r.sender_phone,
    created_at: r.created_at,
    tenant_id: r.tenant_id,
    tenant_name: r.schools?.name || "Établissement",
  }))

  return { data: requests }
}
