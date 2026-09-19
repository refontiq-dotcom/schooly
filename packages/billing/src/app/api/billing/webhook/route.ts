import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initBilling, getProductConfig } from "@/lib/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

/**
 * POST /api/billing/webhook
 *
 * Webhook pour recevoir les notifications de paiement Wave.
 * NOTE: L'API Wave n'est pas encore disponible. Ce endpoint est prepare
 * mais retourne 503 tant que WAVE_WEBHOOK_SECRET n'est pas configure.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WAVE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret === "votre_wave_webhook_secret") {
    return NextResponse.json(
      {
        status: "inactive",
        message: "Webhook Wave non actif. API Wave non disponible ou secret non configure.",
      },
      { status: 503 }
    );
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-wave-signature") || "";

    const crypto = await import("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { amount, status, customer_phone } = payload;

    if (status !== "completed" && status !== "success") {
      return NextResponse.json({ received: true, action: "ignored" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: request } = await supabase
      .from("subscription_payment_requests")
      .select("id, tenant_id, amount")
      .eq("sender_phone", customer_phone)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!request) {
      return NextResponse.json({ received: true, action: "no_matching_request" });
    }

    const tolerance = request.amount * 0.01;
    if (Math.abs(amount - request.amount) > tolerance) {
      return NextResponse.json({ received: true, action: "amount_mismatch" });
    }

    const { error } = await supabase.rpc("validate_subscription_payment", {
      p_request_id: request.id,
      p_validator_id: "wave_webhook",
    });

    if (error) {
      return NextResponse.json({ received: true, action: "validation_failed", error: error.message });
    }

    return NextResponse.json({ received: true, action: "validated", request_id: request.id });
  } catch (err: any) {
    console.error("[Billing Webhook] Error:", err);
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }
}
