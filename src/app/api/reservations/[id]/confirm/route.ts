import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirmation idempotente d'une réservation après paiement.
 *
 * Comportement :
 *   - Si la réservation est déjà en `reserved` ou `confirmed`, retourne 200 sans modification.
 *   - Si elle est en `pending_payment` ou `waitlisted`, appelle `reserve_seat` (idempotent).
 *   - Si elle est dans un état terminal (`expired`, `cancelled`, `rejected_fraud`), retourne 409.
 *
 * Body (optionnel) :
 *   { payment_reference?: string, amount_paid?: number }
 *
 * Réponse 200 : { reservation, already_reserved?: boolean }
 * Réponse 409 : { error, code }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { payment_reference, amount_paid } = body as {
    payment_reference?: string;
    amount_paid?: number;
  };

  const supabase = await createAdminClient();

  // Lecture initiale pour décider si on est déjà dans un état terminal
  const { data: existing } = await supabase
    .from("reservations")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  if (existing.status === "expired" || existing.status === "cancelled" || existing.status === "rejected_fraud") {
    return NextResponse.json(
      {
        error: `Impossible de confirmer une réservation en statut ${existing.status}`,
        code: existing.status.toUpperCase(),
      },
      { status: 409 }
    );
  }

  const alreadyReserved = existing.status === "reserved" || existing.status === "confirmed";

  if (!alreadyReserved) {
    const { error: rpcError } = await supabase.rpc("reserve_seat", {
      p_reservation_id: id,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message, code: "RESERVE_FAILED" },
        { status: 409 }
      );
    }
  }

  if (payment_reference || amount_paid !== undefined) {
    await supabase
      .from("reservations")
      .update({ payment_reference, amount_paid })
      .eq("id", id);
  }

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ reservation, already_reserved: alreadyReserved });
}