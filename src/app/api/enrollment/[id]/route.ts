import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";

const STAFF_ROLES = new Set(["admin", "secretariat", "censeur"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, profile } = await getSessionProfile();
  if (!user || !profile || !STAFF_ROLES.has(profile.role)) {
    return NextResponse.json({ error: "Accès réservé au personnel autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { action?: string; note?: string } | null;
  const action = body?.action;
  const admin = await createAdminClient();

  const { data: application, error: loadError } = await admin
    .from("enrollment_applications")
    .select("*")
    .eq("id", id)
    .eq("establishment_id", profile.establishment_id ?? "")
    .maybeSingle();

  if (loadError || !application) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  if (action === "approve") {
    if (!application.reservation_id) {
      return NextResponse.json({ error: "Ce dossier n'est pas relié à une réservation." }, { status: 409 });
    }
    const { data, error } = await admin.rpc("finalize_reservation", {
      p_reservation_id: application.reservation_id,
      p_section_id: application.recommended_section_id ?? application.requested_section_id ?? null,
      p_actor_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, result: data });
  }

  const allowed = new Set(["under_review", "incomplete", "waitlisted", "rejected"]);
  if (!action || !allowed.has(action)) {
    return NextResponse.json({ error: "Action de validation inconnue" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("enrollment_applications")
    .update({
      status: action,
      review_note: body?.note?.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(action === "rejected" ? { rejected_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("establishment_id", profile.establishment_id ?? "")
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, application: data });
}
