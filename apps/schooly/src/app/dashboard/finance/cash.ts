"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { CASHIER_ROLES } from "@/utils/supabase/roles"
import { parseForm } from "@/lib/schemas/parse-form"
import { cashSessionCloseSchema, cashSessionOpenSchema } from "@/lib/schemas/finance"
import { logServerEvent } from "@/lib/server-logger"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ SESSIONS DE CAISSE ================

export async function getOpenCashSession(schoolId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, null)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("status", "open")
    .single()

  return { data: data || null }
}

export async function getCashSessions(schoolId: string) {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data, error } = await admin
    .from("cash_sessions")
    .select(`
      *,
      users!cash_sessions_opened_by_fkey ( full_name ),
      users!cash_sessions_closed_by_fkey ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("opened_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function openCashSession(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Ouverture de caisse : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const parsed = parseForm(cashSessionOpenSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const { openingAmount } = parsed.data

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: existing } = await admin
    .from("cash_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "open")
    .single()

  if (existing) return { error: "Une session de caisse est déjà ouverte." }

  const { error } = await admin.from("cash_sessions").insert({
    school_id: schoolId,
    opened_by: userId,
    opening_amount: openingAmount,
    status: "open",
  })

  if (error) {
    // Course sur l'index partiel uq_cash_open_per_school : la garde
    // `existing` ci-dessus ne tient pas sous concurrence, l'index tranche.
    if (error.code === "23505" || error.message.includes("uq_cash_open_per_school")) {
      return { error: "Une session de caisse est déjà ouverte." }
    }
    return { error: error.message }
  }

  revalidatePath("/dashboard/caisse")
  return {}
}

export async function closeCashSession(formData: FormData): Promise<ActionResult<{ expected: number; difference: number }>> {
  const supabase = await createClient()

  // Clôture de caisse : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  const parsed = parseForm(cashSessionCloseSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const { closingAmount } = parsed.data

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: session } = await admin
    .from("cash_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("status", "open")
    .single()

  if (!session) return { error: "Aucune session ouverte." }

  const { data: payments } = await admin
    .from("payments")
    .select("amount")
    .eq("cash_session_id", session.id)
    .is("deleted_at", null)

  const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
  const expected = session.opening_amount + totalPayments
  const difference = closingAmount - expected
  const { error } = await admin.from("cash_sessions").update({
    closed_by: userId,
    closing_amount: closingAmount,
    expected_amount: expected,
    difference,
    status: "closed",
    closed_at: new Date().toISOString(),
  }).eq("id", session.id)

  if (error) {
    logServerEvent("error", "cash.close_failed", { schoolId, sessionId: session.id })
    return { error: error.message }
  }

  // R1 : un écart non nul à la clôture est un événement d'audit (warn).
  logServerEvent(difference === 0 ? "info" : "warn", "cash.closed", {
    schoolId,
    sessionId: session.id,
    expected,
    closing: closingAmount,
    difference,
  })

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/caisse/close")
  return { data: { expected, difference } }
}
