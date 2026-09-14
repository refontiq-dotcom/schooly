import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirmation idempotente d'une réservation après paiement.
 *
 * Protégée par un rate limit par IP (30 req / 10 min) : le point de terminaison
 * réserve une place physique, il ne doit pas pouvoir être martelé.
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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Identifiant de réservation invalide" }, { status: 400 });
  }

  const ip = clientIp(req);
  const limit = rateLimit(`confirm:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds!) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { payment_reference, amount_paid } = body as {
    payment_reference?: string;
    amount_paid?: number;
  };

  if (
    payment_reference !== undefined &&
    (typeof payment_reference !== "string" || payment_reference.length > 120)
  ) {
    return NextResponse.json({ error: "Référence de paiement invalide" }, { status: 400 });
  }
  if (
    amount_paid !== undefined &&
    (!Number.isFinite(amount_paid) || amount_paid < 0 || amount_paid > 100_000_000)
  ) {
    return NextResponse.json({ error: "Montant payé invalide" }, { status: 400 });
  }

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

  if (payment_reference !== undefined || amount_paid !== undefined) {
    await supabase
      .from("reservations")
      .update({
        ...(payment_reference !== undefined ? { payment_reference } : {}),
        ...(amount_paid !== undefined ? { amount_paid } : {}),
      })
      .eq("id", id);
  }

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ reservation, already_reserved: alreadyReserved });
}
