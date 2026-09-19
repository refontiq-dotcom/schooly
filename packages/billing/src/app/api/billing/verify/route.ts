import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!;

/**
 * POST /api/billing/verify
 *
 * Verification manuelle d'un paiement Wave par reference transaction.
 * Permet au Super Admin de confirmer un paiement quand le webhook
 * n'est pas disponible.
 *
 * Body: { request_id: string, validator_id: string, verified: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { request_id, validator_id, verified } = body;

    if (!request_id || !validator_id) {
      return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifier que la demande existe et est en attente
    const { data: request } = await supabase
      .from("subscription_payment_requests")
      .select("id, amount, status, tenant_id")
      .eq("id", request_id)
      .eq("status", "pending")
      .maybeSingle();

    if (!request) {
      return NextResponse.json(
        { error: "Demande non trouvee ou deja traitee" },
        { status: 404 }
      );
    }

    if (verified) {
      const { error } = await supabase.rpc("validate_subscription_payment", {
        p_request_id: request_id,
        p_validator_id: validator_id,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("reject_subscription_payment", {
        p_request_id: request_id,
        p_validator_id: validator_id,
      });
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      action: verified ? "validated" : "rejected",
      request_id,
    });
  } catch (err: any) {
    console.error("[Billing Verify] Error:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
