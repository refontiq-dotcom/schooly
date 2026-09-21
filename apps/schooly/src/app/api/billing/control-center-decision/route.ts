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
    const { requestId, action, validatorId, produit } = body ?? {};
    if (!requestId || !["validate", "reject"].includes(action)) {
      return NextResponse.json({ error: "requestId et action requis" }, { status: 400 });
    }

    if (produit === "trouvetou") {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
      );
      const nextStatus = action === "validate" ? "active" : "cancelled";
      const { data, error } = await admin
        .from("trouvetou_ads")
        .update({
          payment_status: nextStatus,
          is_active: action === "validate",
          payment_reference: typeof body.controlCenterRequestId === "string" ? body.controlCenterRequestId : null,
          paid_at: action === "validate" ? new Date().toISOString() : null,
        })
        .eq("id", requestId)
        .select("id,payment_status,is_active,payment_reference,paid_at")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, action, result: data });
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
