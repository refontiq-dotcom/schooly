import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations/:id/confirm
 *
 * Appelée après validation du paiement par l'agrégateur (webhook ou retour
 * de paiement). Utilise le client "service role" car la fonction reserve_seat
 * doit pouvoir décrémenter le quota indépendamment des policies RLS du parent.
 *
 * NB v1 : le paiement lui-même n'est pas intégré (voir README - Phase 1
 * roadmap) ; ce endpoint simule une confirmation de paiement réussie et
 * déclenche la réservation atomique de la place.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { payment_reference, amount_paid } = body;

  const supabase = await createAdminClient();

  const { data: reservation, error: rpcError } = await supabase.rpc("reserve_seat", {
    p_reservation_id: id,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 409 });
  }

  if (payment_reference || amount_paid) {
    await supabase
      .from("reservations")
      .update({ payment_reference, amount_paid })
      .eq("id", id);
  }

  return NextResponse.json({ reservation });
}
