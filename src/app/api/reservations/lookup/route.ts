import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reservations/lookup?token=<qr_code_token>
 * Utilisé par le dashboard Secrétariat pour vérifier l'authenticité
 * d'une réservation à partir du QR code scanné.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const supabase = await createClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*, establishments(name), levels(name), sections(name)")
    .eq("qr_code_token", token)
    .single();

  if (error || !reservation) {
    return NextResponse.json({ error: "Réservation introuvable ou QR code invalide" }, { status: 404 });
  }

  return NextResponse.json({ reservation });
}
