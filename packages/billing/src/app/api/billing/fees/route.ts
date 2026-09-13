import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initBilling, recordBillableEvent, getPlatformFeeLedger, getProductConfig } from "@/lib/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, eventId, tenantId, eventType, amount, academicYearId, periodLabel, periodStart, periodEnd } = body;

    if (!productId || !eventId || !tenantId || !eventType) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    // Vérifier que le produit existe et est en mode event_based
    const config = await getProductConfig(productId);
    if (!config) {
      return NextResponse.json({ error: "Produit non configuré" }, { status: 404 });
    }
    if (config.mode !== "event_based") {
      return NextResponse.json({ error: "Produit non en mode event_based" }, { status: 400 });
    }

    const entry = await recordBillableEvent({
      productId,
      eventId,
      tenantId,
      eventType,
      amount,
      academicYearId,
      periodLabel,
      periodStart,
      periodEnd,
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error("[Billing API] Record fee error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");
    const periodLabel = searchParams.get("periodLabel");

    if (!productId) {
      return NextResponse.json({ error: "productId requis" }, { status: 400 });
    }

    const entries = await getPlatformFeeLedger(productId, {
      tenantId: tenantId || undefined,
      status: status || undefined,
      periodLabel: periodLabel || undefined,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[Billing API] Get fees error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
