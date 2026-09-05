import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Public reservation endpoint.
 * Every successful reservation now also creates the Schooly enrollment dossier,
 * so reservation -> admission -> student is one continuous record.
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
    modality,
  } = body as Record<string, unknown>;

  if (!establishment_id || !level_id || !student_full_name || !parent_full_name || !parent_phone) {
    return NextResponse.json(
      { error: "Champs obligatoires manquants (establishment_id, level_id, student_full_name, parent_full_name, parent_phone)" },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { data: reservation, error } = await supabase.rpc("create_reservation_smart", {
    p_establishment_id: establishment_id,
    p_level_id: level_id,
    p_student_full_name: String(student_full_name),
    p_student_birthdate: student_birthdate ? String(student_birthdate) : null,
    p_parent_full_name: String(parent_full_name),
    p_parent_phone: String(parent_phone),
    p_parent_email: parent_email ? String(parent_email) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  if (!reservation) return NextResponse.json({ error: "Réservation impossible" }, { status: 409 });

  if (reservation.status === "rejected_fraud") {
    return NextResponse.json(
      { error: "Réservation rejetée : motifs de sécurité", code: "FRAUD_REJECTED", fraud_flags: reservation.fraud_flags },
      { status: 403 }
    );
  }

  if (typeof modality === "string" && modality) {
    await supabase.from("reservations").update({ modality }).eq("id", reservation.id);
  }

  const { data: application, error: applicationError } = await supabase.rpc(
    "create_enrollment_application_from_reservation",
    { p_reservation_id: reservation.id, p_applicant_id: user?.id ?? null }
  );

  if (applicationError) {
    console.error("[enrollment] dossier creation failed", applicationError);
    return NextResponse.json(
      { error: "Réservation créée, mais le dossier d'inscription n'a pas pu être initialisé.", reservation },
      { status: 500 }
    );
  }

  const { data: intelligence } = await supabase.rpc("compute_enrollment_intelligence", {
    p_application_id: application.id,
  });

  return NextResponse.json(
    {
      reservation,
      application,
      intelligence: intelligence ?? application,
      waitlist_position: reservation.waitlist_position ?? null,
      parent_trust_score: reservation.parent_trust_score ?? 50,
      fraud_flags: reservation.fraud_flags ?? [],
    },
    { status: 201 }
  );
}