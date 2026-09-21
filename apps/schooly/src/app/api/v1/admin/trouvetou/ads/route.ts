import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { getInclusiveDays, getTrouvetouAdDailyRate } from "@/lib/trouvetou/ad-pricing"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const { data: role } = await admin.from("user_school_roles").select("school_id, role_code").eq("user_id", user.id).eq("is_active", true).in("role_code", [...TROUVETOU_ADMIN_ROLES]).maybeSingle()
    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const body = await request.json()
    const title = String(body.title || "").trim()
    const message = String(body.message || "").trim()
    const imageUrl = String(body.image_url || "").trim()
    const targetUrl = String(body.target_url || "").trim()
    const contactPhone = String(body.contact_phone || "").trim()
    const ctaLabel = String(body.cta_label || "En savoir plus").trim()
    const startDate = String(body.start_date || "")
    const endDate = String(body.end_date || "")
    if (!title || !message) return NextResponse.json({ error: "Le titre et le message sont obligatoires." }, { status: 400 })
    if (!imageUrl) return NextResponse.json({ error: "L'affiche publicitaire est obligatoire." }, { status: 400 })

    const durationDays = getInclusiveDays(startDate, endDate)
    const dailyRate = getTrouvetouAdDailyRate(durationDays)
    if (!dailyRate || durationDays < 1) return NextResponse.json({ error: "La période de publicité est invalide." }, { status: 400 })
    const totalAmount = durationDays * dailyRate

    const { data: ad, error } = await admin.from("trouvetou_ads").insert({
      school_id: role.school_id, title, message, image_url: imageUrl, target_url: targetUrl || null,
      contact_phone: contactPhone || null, cta_label: ctaLabel || "En savoir plus",
      start_date: startDate, end_date: endDate, duration_days: durationDays, daily_rate: dailyRate,
      total_amount: totalAmount, payment_status: "pending_payment", is_active: false,
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
          sender_phone: contactPhone || null,
          notes: `Publicité: ${title} • ${durationDays} jour(s) • ${startDate} → ${endDate} • Établissement: ${role.school_id}`,
        }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!controlCenterResponse.ok) {
        await admin.from("trouvetou_ads").delete().eq("id", ad.id)
        const body = await controlCenterResponse.text()
        console.error("[Trouvetou billing] Control Center refused request:", controlCenterResponse.status, body)
        return NextResponse.json({ error: "Impossible d'enregistrer la demande de paiement centralisée." }, { status: 502 })
      }
    }

    return NextResponse.json({ success: true, payment_required: true, payment_provider: "wave_business", ad })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
