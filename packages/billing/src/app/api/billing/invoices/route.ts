import { NextRequest, NextResponse } from "next/server";
import { initBilling, generatePlatformInvoices, getPlatformInvoices, markFeesCollected } from "@/lib/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, periodLabel, periodStart, periodEnd, tenantId, paidAmount } = body;

    if (tenantId && paidAmount !== undefined) {
      // Marquer comme payé
      const updated = await markFeesCollected(productId, tenantId, periodLabel, paidAmount);
      return NextResponse.json({ success: true, updated });
    }

    if (!productId || !periodLabel || !periodStart || !periodEnd) {
      return NextResponse.json({ error: "Paramètres manquants pour génération factures" }, { status: 400 });
    }

    const invoices = await generatePlatformInvoices(productId, periodLabel, periodStart, periodEnd);
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    console.error("[Billing API] Invoices error:", error);
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

    const invoices = await getPlatformInvoices(productId, {
      tenantId: tenantId || undefined,
      status: status || undefined,
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("[Billing API] Get invoices error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
