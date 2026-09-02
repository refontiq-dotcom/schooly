import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function authorized(request: NextRequest) {
  const expected = process.env.TROUVETOU_API_KEY_PEPPER ?? process.env.TROUVETOU_API_KEY;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

function unauthorized() {
  return NextResponse.json({ error: "Clé API invalide" }, { status: 401 });
}

/** GET /api/trouvetou/establishments - catalogue publié et disponibilités. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const supabase = await createAdminClient();
  const { data: establishments, error } = await supabase
    .from("establishments")
    .select("id, name, description, city, address, school_type, latitude, longitude, website_url, cover_image_url, reservation_fee_amount")
    .eq("published_to_trouvetou", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (establishments ?? []).map((establishment) => establishment.id);
  const { data: availability, error: availabilityError } = ids.length
    ? await supabase.from("level_availability").select("*").in("establishment_id", ids)
    : { data: [], error: null };
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError.message }, { status: 500 });
  }

  const { data: ads, error: adsError } = ids.length
    ? await supabase
        .from("trouvetou_ads")
        .select("id, establishment_id, title, description, image_url, target_url, starts_at, ends_at")
        .in("establishment_id", ids)
        .eq("active", true)
        .lte("starts_at", new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    : { data: [], error: null };
  if (adsError) return NextResponse.json({ error: adsError.message }, { status: 500 });

  const availabilityByEstablishment = new Map<string, typeof availability>();
  for (const level of availability ?? []) {
    const levels = availabilityByEstablishment.get(level.establishment_id) ?? [];
    levels.push(level);
    availabilityByEstablishment.set(level.establishment_id, levels);
  }
  const adsByEstablishment = new Map<string, typeof ads>();
  for (const ad of ads ?? []) {
    const currentAds = adsByEstablishment.get(ad.establishment_id) ?? [];
    currentAds.push(ad);
    adsByEstablishment.set(ad.establishment_id, currentAds);
  }

  return NextResponse.json({
    establishments: (establishments ?? []).map((establishment) => ({
      ...establishment,
      category: "ecoles",
      availability: availabilityByEstablishment.get(establishment.id) ?? [],
      advertisements: adsByEstablishment.get(establishment.id) ?? [],
    })),
  });
}

/** POST /api/trouvetou - crée un dossier en attente de paiement. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  const {
    establishment_id,
    level_id,
    student_full_name,
    student_birthdate,
    parent_full_name,
    parent_phone,
    parent_email,
  } = body ?? {};

  if (!establishment_id || !level_id || !student_full_name || !parent_full_name || !parent_phone) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc("create_trouvetou_reservation", {
    p_establishment_id: establishment_id,
    p_level_id: level_id,
    p_student_full_name: student_full_name,
    p_student_birthdate: student_birthdate || null,
    p_parent_full_name: parent_full_name,
    p_parent_phone: parent_phone,
    p_parent_email: parent_email || null,
  });

  if (error) {
    const status = error.message.includes("Plus de place") ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ reservation: data }, { status: 201 });
}