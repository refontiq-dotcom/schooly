import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations/:id/promote
 *
 * Force la promotion d'une réservation en file d'attente vers `reserved`
 * (en attribuant la première section disponible du niveau).
 *
 * Authentification : admin/secretariat uniquement.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id, level_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !reservation) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  if (reservation.status !== "waitlisted") {
    return NextResponse.json(
      { error: `Promotion impossible depuis le statut ${reservation.status}` },
      { status: 409 }
    );
  }

  const { data: promotedCount, error: rpcError } = await supabase.rpc("promote_waitlist", {
    p_level: reservation.level_id,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ reservation: updated, promoted_in_level: promotedCount });
}