"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { PRICING_ROLES } from "@/utils/supabase/roles"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ RELANCES AUTOMATIQUES =============

/**
 * Génère les relances du jour : pour chaque inscription impayée dont la
 * prochaine échéance est passée ou imminente, pousse un message WhatsApp dans
 * notification_outbox (file avec retry — l'envoi réel est le travail du
 * worker). Idempotent par clé de template : un parent n'est relancé qu'UNE
 * fois par échéance et par palier (J-5 / J+1 / J+7), grâce au check
 * d'existence sur (template_key + payload->enrollment_id + scheduled date).
 * Degrés : J-5 préventif, J+1 formel, J+7 avertissement.
 */
export async function generateDueReminders(): Promise<ActionResult<{ queued: number; skipped: number }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const todayISO = new Date().toISOString().slice(0, 10)
  const inFive = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)

  const { data: balances, error } = await admin
    .from("v_student_balances")
    .select("enrollment_id, first_name, last_name, guardian_name, guardian_phone, balance, next_due_date, next_due_amount")
    .eq("school_id", schoolId)
    .gt("balance", 0)

  if (error) return { error: error.message }

  type Row = {
    enrollment_id: string
    first_name: string
    last_name: string
    guardian_name: string | null
    guardian_phone: string | null
    balance: number
    next_due_date: string | null
    next_due_amount: number | null
  }
  const rows = (balances ?? []) as Row[]

  const toQueue: Array<{
    school_id: string
    recipient_phone: string
    channel: string
    template_key: string
    payload: Record<string, unknown>
  }> = []
  let skipped = 0

  for (const r of rows) {
    if (!r.guardian_phone || !r.next_due_date) continue
    const amount = r.next_due_amount ?? r.balance
    const base = {
      student: `${r.first_name} ${r.last_name}`,
      guardian: r.guardian_name,
      due_date: r.next_due_date,
      amount,
      balance: r.balance,
    }

    let templateKey: string | null = null
    if (r.next_due_date === todayISO) templateKey = "fee_reminder_j0"
    else if (r.next_due_date <= inFive && r.next_due_date > todayISO) templateKey = "fee_reminder_j5"
    else if (r.next_due_date < todayISO && r.next_due_date >= yesterday) templateKey = "fee_reminder_j1"
    else if (r.next_due_date < weekAgo) templateKey = "fee_reminder_j7"

    if (!templateKey) {
      skipped += 1
      continue
    }

    // Anti-doublon : une relance du même palier pour la même échéance n'est
    // jamais recréée (payload->>'enrollment_id' + template + due_date).
    const { data: existing } = await admin
      .from("notification_outbox")
      .select("id")
      .eq("school_id", schoolId)
      .eq("template_key", templateKey)
      .eq("payload->>enrollment_id", r.enrollment_id)
      .eq("payload->>due_date", r.next_due_date)
      .is("deleted_at", null)
      .maybeSingle()

    if (existing) {
      skipped += 1
      continue
    }

    toQueue.push({
      school_id: schoolId,
      recipient_phone: r.guardian_phone,
      channel: "whatsapp",
      template_key: templateKey,
      payload: { enrollment_id: r.enrollment_id, ...base },
    })
  }

  if (toQueue.length > 0) {
    const { error: insertError } = await admin.from("notification_outbox").insert(toQueue)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath("/dashboard/direction/finance/reminders")
  return { data: { queued: toQueue.length, skipped } }
}
