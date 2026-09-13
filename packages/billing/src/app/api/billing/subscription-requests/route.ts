import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initBilling, createSubscriptionPaymentRequest, getProductConfig } from "@/lib/billing";

// Initialiser le billing avec les variables d'env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, tenantId, tierId, amount, senderPhone, requestedBy, notes } = body;

    if (!productId || !tenantId || !tierId || !amount || !senderPhone) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    // Vérifier que le produit existe et est en mode subscription_tiers
    const config = await getProductConfig(productId);
    if (!config) {
      return NextResponse.json({ error: "Produit non configuré" }, { status: 404 });
    }
    if (config.mode !== "subscription_tiers") {
      return NextResponse.json({ error: "Produit non en mode subscription_tiers" }, { status: 400 });
    }

    const request = await createSubscriptionPaymentRequest({
      productId,
      tenantId,
      tierId,
      amount,
      senderPhone,
      requestedBy,
      notes,
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    if (error.message.includes("PENDING_REQUEST_EXISTS")) {
      return NextResponse.json({ success: true, alreadyPending: true }, { status: 200 });
    }
    console.error("[Billing API] Create subscription request error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");

    if (!productId) {
      return NextResponse.json({ error: "productId requis" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let query = supabase
      .from("subscription_payment_requests")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    console.error("[Billing API] Get requests error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
