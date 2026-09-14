import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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
 * La route est publique mais protégée par :
 *   - un contrôle d'origine (anti-CSRF basique) ;
 *   - un rate limit par IP (60 req / 10 min).
 *
 * Réponse 201 :
 *   - { reservation } : réservation créée (status = reserved | waitlisted | rejected_fraud)
 *   - { waitlist_position } : position dans la file (null si place dispo)
 *   - { parent_trust_score } : score 0..100
 *   - { fraud_flags } : flags de fraude détectés
 *
 * Réponse 429 : trop de requêtes. 409 : données invalides. 403 : fraude.
 */

const MAX_LENGTHS = {
  student_full_name: 120,
  parent_full_name: 120,
  parent_phone: 24,
  parent_email: 160,
};

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Trop de requêtes. Réessayez dans un instant." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`reservations:${ip}`, 60, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds!);

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get("host")) {
        return NextResponse.json({ error: "Origine invalide" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Origine invalide" }, { status: 403 });
    }
  }

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

  const isUuid = (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  if (!isUuid(establishment_id) || !isUuid(level_id)) {
    return NextResponse.json({ error: "Identifiants d'établissement ou de niveau invalides" }, { status: 400 });
  }

  const names = {
    student_full_name: String(student_full_name).trim(),
    parent_full_name: String(parent_full_name).trim(),
    parent_phone: String(parent_phone).trim(),
  };
  if (!names.student_full_name || !names.parent_full_name || !names.parent_phone) {
    return NextResponse.json({ error: "Champs obligatoires vides" }, { status: 400 });
  }
  for (const [field, value] of Object.entries({ ...names, parent_email: parent_email ? String(parent_email).trim() : "" })) {
    if (value.length > MAX_LENGTHS[field as keyof typeof MAX_LENGTHS]) {
      return NextResponse.json({ error: `Champ trop long : ${field}` }, { status: 400 });
    }
  }
  if (parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(parent_email))) {
    return NextResponse.json({ error: "Adresse email du parent invalide" }, { status: 400 });
  }
  if (student_birthdate && Number.isNaN(Date.parse(String(student_birthdate)))) {
    return NextResponse.json({ error: "Date de naissance invalide" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  const { data: reservation, error } = await supabase.rpc("create_reservation_smart", {
    p_establishment_id: establishment_id,
    p_level_id: level_id,
    p_student_full_name: names.student_full_name,
    p_student_birthdate: student_birthdate ? String(student_birthdate) : null,
    p_parent_full_name: names.parent_full_name,
    p_parent_phone: names.parent_phone,
    p_parent_email: parent_email ? String(parent_email).trim() : null,
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
