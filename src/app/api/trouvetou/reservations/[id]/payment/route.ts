import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function authorized(request: NextRequest) {
  const expected = process.env.TROUVETOU_API_KEY_PEPPER ?? process.env.TROUVETOU_API_KEY;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

/** POST /api/trouvetou/reservations/:id/payment - confirme un paiement Trouvetou. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Clé API invalide" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const paymentReference = String(body?.payment_reference ?? "").trim();
  const amountPaid = Number(body?.amount_paid);
  if (!paymentReference || !Number.isFinite(amountPaid) || amountPaid <= 0) {
    return NextResponse.json(
      { error: "Référence et montant du paiement requis" },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const { data: existing } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (existing.status === "reserved" || existing.status === "confirmed") {
    return NextResponse.json({ reservation: existing });
  }
  if (existing.status !== "pending_payment") {
    return NextResponse.json({ error: "Réservation non payable" }, { status: 409 });
  }

  const { data: reservation, error: reserveError } = await supabase.rpc("reserve_seat", {
    p_reservation_id: id,
  });
  if (reserveError) {
    const status = reserveError.message.includes("Plus de place") ? 409 : 400;
    return NextResponse.json({ error: reserveError.message }, { status });
  }

  const { data: updated, error: updateError } = await supabase
    .from("reservations")
    .update({ payment_reference: paymentReference, amount_paid: amountPaid })
    .eq("id", id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ reservation: updated ?? reservation });
}