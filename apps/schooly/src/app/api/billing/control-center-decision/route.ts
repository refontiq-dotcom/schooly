import { NextResponse } from "next/server";
import { initBilling, validateSubscriptionPayment, rejectSubscriptionPayment } from "@refontiq/billing";

const sharedSecret = process.env.METRICS_PUSH_SECRET;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!sharedSecret || auth !== `Bearer ${sharedSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { requestId, action, validatorId } = body ?? {};
    if (!requestId || !["validate", "reject"].includes(action)) {
      return NextResponse.json({ error: "requestId et action requis" }, { status: 400 });
    }

    initBilling(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
    const safeValidatorId = typeof validatorId === "string" ? validatorId : "";

    const result = action === "validate"
      ? await validateSubscriptionPayment(requestId, safeValidatorId)
      : await rejectSubscriptionPayment(requestId, safeValidatorId);

    return NextResponse.json({ success: true, action, result });
  } catch (error) {
    console.error("[Control Center billing callback]", error);
    return NextResponse.json({ error: "Synchronisation billing impossible" }, { status: 500 });
  }
}
