import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const STAFF_ROLES = new Set(["admin", "secretariat", "censeur"]);
const MODALITIES = new Set(["standard", "bourse", "transfert", "fratrie", "convention"]);

/**
 * POST /api/enrollment/physical
 * Creates an enrollment dossier at the school counter.
 * Documents are recorded as a checklist only; no file is uploaded.
 */
export async function POST(req: NextRequest) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile || !STAFF_ROLES.has(profile.role) || !profile.establishment_id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const levelId = String(data.level_id ?? "").trim();
  const studentName = String(data.student_full_name ?? "").trim();
  const parentName = String(data.parent_full_name ?? "").trim();
  const parentPhone = String(data.parent_phone ?? "").trim();
  const birthdate = data.student_birthdate ? String(data.student_birthdate) : null;
  const parentEmail = data.parent_email ? String(data.parent_email).trim().toLowerCase() : null;
  const modality = String(data.modality ?? "standard").trim();
  const providedDocuments = Array.isArray(data.provided_documents)
    ? data.provided_documents.map(String)
    : [];

  if (!levelId || !studentName || !parentName || !parentPhone) {
    return NextResponse.json(
      { error: "Niveau, élève, parent/tuteur et téléphone sont obligatoires." },
      { status: 400 }
    );
  }

  if (!MODALITIES.has(modality)) {
    return NextResponse.json({ error: "Modalité d'inscription invalide." }, { status: 400 });
  }

  const supabase = await createAdminClient();

  const { data: reservation, error: reservationError } = await supabase.rpc("create_reservation_smart", {
    p_establishment_id: profile.establishment_id,
    p_level_id: levelId,
    p_student_full_name: studentName,
    p_student_birthdate: birthdate,
    p_parent_full_name: parentName,
    p_parent_phone: parentPhone,
    p_parent_email: parentEmail,
  });

  if (reservationError || !reservation) {
    return NextResponse.json(
      { error: reservationError?.message ?? "Impossible de créer le dossier." },
      { status: 409 }
    );
  }

  if (reservation.status === "rejected_fraud") {
    return NextResponse.json(
      { error: "Dossier bloqué par les contrôles de sécurité.", fraud_flags: reservation.fraud_flags },
      { status: 403 }
    );
  }

  const { error: modalityError } = await supabase
    .from("reservations")
    .update({ modality })
    .eq("id", reservation.id)
    .eq("establishment_id", profile.establishment_id);

  if (modalityError) {
    return NextResponse.json({ error: modalityError.message }, { status: 500 });
  }

  const { data: application, error: applicationError } = await supabase.rpc(
    "create_enrollment_application_from_reservation",
    { p_reservation_id: reservation.id, p_applicant_id: null }
  );

  if (applicationError || !application) {
    return NextResponse.json(
      { error: applicationError?.message ?? "Impossible d'initialiser le dossier d'inscription." },
      { status: 500 }
    );
  }

  // The SQL function seeds the required checklist from the selected modality.
  // Here we only mark documents explicitly handed over at the counter.
  if (providedDocuments.length > 0) {
    const { error: documentsError } = await supabase
      .from("enrollment_documents")
      .update({ status: "provided", updated_at: new Date().toISOString() })
      .eq("enrollment_id", application.id)
      .in("document_type", providedDocuments);

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }
  }

  const { data: intelligence, error: intelligenceError } = await supabase.rpc("compute_enrollment_intelligence", {
    p_application_id: application.id,
  });

  if (intelligenceError) {
    return NextResponse.json({ error: intelligenceError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      application,
      intelligence,
      reservation,
      message: "Dossier physique créé. Les documents sont enregistrés comme checklist uniquement.",
    },
    { status: 201 }
  );
}
