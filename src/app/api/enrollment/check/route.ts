import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const STAFF_ROLES = new Set(["admin", "secretariat", "censeur"]);

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("225")) return digits;
  if (digits.length === 10) return `225${digits}`;
  return digits;
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile || !STAFF_ROLES.has(profile.role) || !profile.establishment_id) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(body?.student_full_name ?? "").trim();
  const phone = normalizePhone(String(body?.parent_phone ?? ""));
  const birthdate = body?.student_birthdate ? String(body.student_birthdate) : null;

  if (!name || !phone) {
    return NextResponse.json({ risk: 0, flags: [], duplicateCount: 0, phoneChildrenCount: 0 });
  }

  const admin = await createAdminClient();
  const { data: students } = await admin
    .from("students")
    .select("id,full_name,birthdate,parent_phone")
    .eq("establishment_id", profile.establishment_id);

  const { data: reservations } = await admin
    .from("reservations")
    .select("id,student_full_name,student_birthdate,parent_phone,parent_full_name,status")
    .eq("establishment_id", profile.establishment_id)
    .in("status", ["pending_payment", "reserved", "confirmed", "waitlisted"]);

  const exactStudent = (students ?? []).filter((student) =>
    normalize(student.full_name ?? "") === normalize(name) &&
    ((birthdate && student.birthdate === birthdate) || (!birthdate && !student.birthdate))
  );

  const exactReservation = (reservations ?? []).filter((reservation) =>
    normalize(reservation.student_full_name ?? "") === normalize(name) &&
    normalizePhone(reservation.parent_phone ?? "") === phone
  );

  const samePhoneReservations = (reservations ?? []).filter(
    (reservation) => normalizePhone(reservation.parent_phone ?? "") === phone
  );

  const phoneChildren = (students ?? []).filter(
    (student) => normalizePhone(student.parent_phone ?? "") === phone
  );

  const flags: string[] = [];
  let risk = 0;
  if (exactStudent.length > 0) {
    flags.push("DUPLICATE_STUDENT");
    risk = Math.max(risk, 95);
  }
  if (exactReservation.length > 0) {
    flags.push("ACTIVE_DUPLICATE_RESERVATION");
    risk = Math.max(risk, 90);
  }
  if (samePhoneReservations.some((reservation) => normalize(reservation.parent_full_name ?? "") !== normalize(String(body?.parent_full_name ?? "")))) {
    flags.push("PHONE_NAME_MISMATCH");
    risk = Math.max(risk, 65);
  }

  return NextResponse.json({
    risk,
    flags,
    duplicateCount: exactStudent.length + exactReservation.length,
    phoneChildrenCount: phoneChildren.length,
  });
}
