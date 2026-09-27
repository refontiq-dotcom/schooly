import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { trouvetouAdSchema } from "@/lib/schemas/trouvetou"
import { getInclusiveDays, getTrouvetouAdDailyRate } from "@/lib/trouvetou/ad-pricing"
import { logServerEvent } from "@/lib/server-logger"

/** Délai maximal d'attente de la réponse du Control Center. */
const CONTROL_CENTER_TIMEOUT_MS = 10_000

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const { data: role } = await admin.from("user_school_roles").select("school_id, role_code").eq("user_id", user.id).eq("is_active", true).in("role_code", [...TROUVETOU_ADMIN_ROLES]).maybeSingle()
    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const payload: unknown = await request.json()
    const parsed = trouvetouAdSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données de la publicité invalides." },
        { status: 400 },
      )
    }
    const body = parsed.data
    const durationDays = getInclusiveDays(body.start_date, body.end_date)
    const dailyRate = getTrouvetouAdDailyRate(durationDays)
    if (!dailyRate || durationDays < 1) {
      return NextResponse.json({ error: "La période de publicité est invalide." }, { status: 400 })
    }
    const totalAmount = durationDays * dailyRate

    const { data: ad, error } = await admin.from("trouvetou_ads").insert({
      school_id: role.school_id,
      title: body.title,
      message: body.message,
      image_url: body.image_url,
      target_url: body.target_url,
      contact_phone: body.contact_phone,
      cta_label: body.cta_label,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_days: durationDays,
      daily_rate: dailyRate,
      total_amount: totalAmount,
      payment_status: "pending_payment",
      is_active: false,
    }).select("id, title, start_date, end_date, duration_days, daily_rate, total_amount, payment_status").single()

    if (error) throw error

    const controlCenterUrl = (process.env.CONTROL_CENTER_URL || "").replace(/\/$/, "")
    const sharedSecret = process.env.METRICS_PUSH_SECRET
    if (controlCenterUrl && sharedSecret) {
      const controlCenterResponse = await fetch(`${controlCenterUrl}/api/billing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sharedSecret}`,
        },
        body: JSON.stringify({
          produit: "trouvetou",
          produit_ref: ad.id,
          plan: "trouvetou_publicite",
          amount: totalAmount,
          requested_by: user.id,
          sender_phone: body.contact_phone,
          notes: `Publicité: ${body.title} • ${durationDays} jour(s) • ${body.start_date} → ${body.end_date} • Établissement: ${role.school_id}`,
        }),
        signal: AbortSignal.timeout(CONTROL_CENTER_TIMEOUT_MS),
      })

      if (!controlCenterResponse.ok) {
        await admin.from("trouvetou_ads").delete().eq("id", ad.id)
        logServerEvent("error", "trouvetou.ad.billing_refused", {
          ad_id: ad.id,
          school_id: role.school_id,
          control_center_status: controlCenterResponse.status,
        })
        return NextResponse.json({ error: "Impossible d'enregistrer la demande de paiement centralisée." }, { status: 502 })
      }
    }

    return NextResponse.json({ success: true, payment_required: true, payment_provider: "wave_business", ad })
  } catch (error: unknown) {
    logServerEvent("error", "trouvetou.ad.failed", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Impossible de créer la publicité." }, { status: 500 })
  }
}
