import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations
 *
 * Crée une réservation via `create_reservation_smart` qui encapsule :
 *   - attribution atomique d'une section (anti-survente par `FOR UPDATE`) ;
 *   - calcul du score de confiance du parent (compute_parent_trust_score) ;
 *   - détection de fraude (detect_reservation_fraud) ;
 *   - mise en file d'attente (status = 'waitlisted') si plus de place ;
 *   - rejet pour fraude si plus de 2 flags sont levés (status = 'rejected_fraud').
 *
 * Réponse 201 :
 *   - { reservation } : réservation créée (status = reserved | waitlisted | rejected_fraud)
 *   - { waitlist_position } : position dans la file (null si place dispo)
 *   - { parent_trust_score } : score 0..100
 *   - { fraud_flags } : flags de fraude détectés
 *
 * Réponse 409 : données invalides ou frauduleuses (avec détail).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const {
    establishment_id,
    level_id,
    student_full_name,
    student_birthdate,
    parent_full_name,
    parent_phone,
    parent_email,
  } = body as Record<string, unknown>;

  if (
    !establishment_id ||
    !level_id ||
    !student_full_name ||
    !parent_full_name ||
    !parent_phone
  ) {
    return NextResponse.json(
      { error: "Champs obligatoires manquants (establishment_id, level_id, student_full_name, parent_full_name, parent_phone)" },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();

  const { data: reservation, error } = await supabase.rpc("create_reservation_smart", {
    p_establishment_id: establishment_id,
    p_level_id: level_id,
    p_student_full_name: String(student_full_name),
    p_student_birthdate: student_birthdate ? String(student_birthdate) : null,
    p_parent_full_name: String(parent_full_name),
    p_parent_phone: String(parent_phone),
    p_parent_email: parent_email ? String(parent_email) : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (!reservation) {
    return NextResponse.json({ error: "Réservation impossible" }, { status: 409 });
  }

  if (reservation.status === "rejected_fraud") {
    return NextResponse.json(
      {
        error: "Réservation rejetée : motifs de sécurité",
        code: "FRAUD_REJECTED",
        fraud_flags: reservation.fraud_flags,
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      reservation,
      waitlist_position: reservation.waitlist_position ?? null,
      parent_trust_score: reservation.parent_trust_score ?? 50,
      fraud_flags: reservation.fraud_flags ?? [],
    },
    { status: 201 }
  );
}