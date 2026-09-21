"use server"

import { createClient } from "@/utils/supabase/server"
import { FINANCE_CONTEXT_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { sendTelegramAlert } from "@/lib/telegram"

type ActionResult<T = void> = { error?: string; data?: T }

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY!
const getAdmin = () => createAdminClient(ADMIN_URL, ADMIN_KEY)

async function mirrorPaymentRequestToControlCenter(input: {
  requestId: string; schoolId: string; amount: number; userId: string; senderPhone: string; notes: string | null
}) {
  const base = (process.env.CONTROL_CENTER_URL || "").replace(/\/$/, "")
  const secret = process.env.METRICS_PUSH_SECRET
  if (!base || !secret) return
  try {
    const res = await fetch(`${base}/api/billing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        produit: "schooly", produit_ref: input.requestId, plan: "school_event_based",
        amount: input.amount, requested_by: input.userId, sender_phone: input.senderPhone, notes: input.notes,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error("[Control Center billing] push refusé:", res.status, await res.text())
  } catch (error) {
    console.error("[Control Center billing] push impossible:", error)
  }
}

export async function getBillingContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("NOT_AUTHENTICATED")
  const { data: role } = await supabase.from("user_school_roles").select("school_id, role_code")
    .eq("user_id", user.id).eq("is_active", true).in("role_code", [...FINANCE_CONTEXT_ROLES]).limit(1).maybeSingle()
  if (!role) throw new Error("UNAUTHORIZED")
  const { data: school } = await getAdmin().from("schools").select("id, name, city").eq("id", role.school_id).single()
  return { userId: user.id, schoolId: role.school_id, roleCode: role.role_code,
    school: school as { id: string; name: string; city: string | null } | null }
}

export async function getSchoolyConfig() {
  const admin = getAdmin()
  const { data } = await admin.from("billing_configs").select("event_amount, event_types")
    .eq("product_id", "schooly").eq("is_active", true).single()
  return { eventAmount: (data?.event_amount as number) || 1000,
    eventTypes: (data?.event_types as string[]) || ["enrollment_confirmed"] }
}

export async function getSchoolBillingSummary() {
  const { schoolId } = await getBillingContext()
  const admin = getAdmin()
  const config = await getSchoolyConfig()

  const { data: academicYear } = await admin
    .from("academic_years")
    .select("id, label, start_date, end_date, status")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .eq("status", "en_cours")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!academicYear) {
    return {
      eventAmount: config.eventAmount,
      academicYear: null,
      billableStudents: 0,
      billedAmount: 0,
      validatedSum: 0,
      pendingSum: 0,
      remainingAmount: 0,
      pendingRequests: [],
      totalRequests: 0,
      billingEvents: 0,
    }
  }

  const { data: ledger } = await admin
    .from("platform_fee_ledger")
    .select("id, event_id, amount, status, created_at")
    .eq("product_id", "schooly")
    .eq("tenant_id", schoolId)
    .eq("academic_year_id", academicYear.id)
    .eq("event_type", "enrollment_confirmed")
    .order("created_at", { ascending: false })

  const { data: requests } = await admin
    .from("subscription_payment_requests")
    .select("id, amount, status, created_at")
    .eq("product_id", "schooly")
    .eq("tenant_id", schoolId)
    .gte("created_at", `${academicYear.start_date}T00:00:00.000Z`)
    .lte("created_at", `${academicYear.end_date}T23:59:59.999Z`)
    .order("created_at", { ascending: false })

  const billingEvents = ledger ?? []
  const billedAmount = billingEvents.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const pending = (requests ?? []).filter((r) => r.status === "pending")
  const validated = (requests ?? []).filter((r) => r.status === "validated")
  const pendingSum = pending.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const validatedSum = validated.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const remainingAmount = Math.max(0, billedAmount - validatedSum - pendingSum)

  return {
    eventAmount: config.eventAmount,
    academicYear,
    billableStudents: billingEvents.length,
    billedAmount,
    validatedSum,
    pendingSum,
    remainingAmount,
    pendingRequests: pending,
    totalRequests: (requests ?? []).length,
    billingEvents: billingEvents.length,
  }
}

export async function createSubscriptionPaymentRequest(formData: FormData): Promise<ActionResult<{ schoolId: string; amount: number }>> {
  const { userId, schoolId } = await getBillingContext().catch(() => { throw new Error("NOT_AUTHENTICATED") })
  const amount = parseInt((formData.get("amount") as string) || "0", 10)
  const senderPhone = ((formData.get("senderPhone") as string) || "").trim()
  const notes = ((formData.get("notes") as string | null) || "").trim() || null
  if (amount <= 0) return { error: "Montant invalide." }
  if (!senderPhone) return { error: "Numéro Wave requis." }
  if (!/^(0[1-9]\d{8}|\+225\s?0[1-9]\d{8})$/.test(senderPhone.replace(/\s/g, ""))) {
    return { error: "Format invalide. Ex: 07xxxxxxxx ou +225 07xxxxxxxx" }
  }

  const admin = getAdmin()
  const { data: request, error } = await admin.from("subscription_payment_requests").insert({
    product_id: "schooly", tenant_id: schoolId, tier_id: "school_event_based",
    amount, status: "pending", requested_by: userId, sender_phone: senderPhone,
    payment_provider: "wave", notes,
  }).select("id").single()

  if (error || !request) {
    if (error?.code === "23505") return { error: "Une demande est déjà en attente pour cet établissement." }
    return { error: "Erreur lors de la création de la demande." }
  }

  await Promise.allSettled([
    mirrorPaymentRequestToControlCenter({ requestId: request.id, schoolId, amount, userId, senderPhone, notes }),
    sendTelegramAlert(
      `🔔 *Nouvelle demande de paiement*\nÉtablissement : ${schoolId}\nMontant : ${amount.toLocaleString("fr-FR")} FCFA\nNuméro : ${senderPhone}`,
      "info"
    ),
  ])

  revalidatePath("/dashboard/billing")
  return { data: { schoolId, amount } }
}

export async function getMyPaymentRequests(): Promise<ActionResult<Array<{
  id: string; amount: number; status: string; sender_phone: string; created_at: string; tenant_name?: string
}>>> {
  const ctx = await getBillingContext().catch(() => null)
  if (!ctx) return { error: "Non authentifié.", data: [] }
  let query = getAdmin().from("subscription_payment_requests")
    .select("id, amount, status, sender_phone, created_at, tenant_id")
    .eq("product_id", "schooly").order("created_at", { ascending: false })
  if (ctx.schoolId) query = query.eq("tenant_id", ctx.schoolId)
  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}
