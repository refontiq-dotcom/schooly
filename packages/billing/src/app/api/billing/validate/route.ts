import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initBilling, validateSubscriptionPayment, getProductConfig } from "@/lib/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
initBilling(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, validatorId } = body;

    if (!requestId) {
      return NextResponse.json({ error: "requestId requis" }, { status: 400 });
    }

    const result = await validateSubscriptionPayment(requestId, validatorId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Billing API] Validate error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
