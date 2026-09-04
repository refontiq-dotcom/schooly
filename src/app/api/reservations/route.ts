import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations
 * Crée une réservation au statut "pending_payment". La place n'est
 * décomptée qu'après confirmation du paiement (voir /api/reservations/[id]/confirm),
 * via la fonction Postgres reserve_seat() qui verrouille la section
 * pour éviter toute survente en cas de réservations simultanées.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const {
    establishment_id,
    level_id,
    modality,
    student_full_name,
    student_birthdate,
    parent_full_name,
    parent_phone,
    parent_email,
  } = body;

  if (!establishment_id || !level_id || !student_full_name || !parent_full_name || !parent_phone) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  // Vérifie qu'il reste au moins une place sur le niveau avant de créer la réservation
  const { data: availability } = await supabase
    .from("level_availability")
    .select("seats_available")
    .eq("level_id", level_id)
    .single();

  if (!availability || availability.seats_available <= 0) {
    return NextResponse.json({ error: "Plus de place disponible pour ce niveau" }, { status: 409 });
  }

  // Assigne automatiquement la première section du niveau ayant de la place
  const { data: openSection } = await supabase
    .from("sections")
    .select("id, capacity, seats_taken")
    .eq("level_id", level_id)
    .order("name")
    .limit(50);

  const section = (openSection ?? []).find((s) => s.seats_taken < s.capacity);
  if (!section) {
    return NextResponse.json({ error: "Plus de place disponible pour ce niveau" }, { status: 409 });
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      establishment_id,
      level_id,
      section_id: section.id,
      modality: modality || "standard",
      student_full_name,
      student_birthdate: student_birthdate || null,
      parent_full_name,
      parent_phone,
      parent_email: parent_email || null,
      status: "pending_payment",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reservation }, { status: 201 });
}
