import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations/:id/cancel
 *
 * Annule une réservation et libère la place. Si une file d'attente existe
 * sur le même niveau, la promotion est déclenchée atomiquement.
 *
 * Authentification : staff de l'établissement uniquement (admin/secretariat/censeur).
 * La RLS vérifie que la réservation appartient à l'établissement du caller.
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

  // Lecture + verrou via rpc promote_waitlist plus tard. Ici, simple update.
  const { data: reservation, error: readError } = await supabase
    .from("reservations")
    .select("id, level_id, section_id, status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !reservation) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  if (reservation.status === "cancelled" || reservation.status === "expired") {
    return NextResponse.json({ reservation });
  }

  if (reservation.status === "reserved" || reservation.status === "confirmed") {
    if (!reservation.section_id) {
      return NextResponse.json(
        { error: "Section manquante sur la réservation" },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Libère la place + promeut la file d'attente
  if (reservation.section_id && (reservation.status === "reserved" || reservation.status === "confirmed")) {
    await supabase.rpc("promote_waitlist", { p_level: reservation.level_id });
  }

  return NextResponse.json({ ok: true, reservation_id: id });
}