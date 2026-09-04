"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BulkGradeEntry {
  studentId: string;
  score: number;
  maxScore?: number;
}

export async function bulkAddGrades(
  sectionId: string,
  subject: string,
  evaluationType: string,
  entries: BulkGradeEntry[],
  evaluationDate?: string
): Promise<string | null> {
  if (entries.length === 0) return "Aucune note à enregistrer.";
  if (!subject || subject.trim().length === 0) return "Matière requise.";
  if (!evaluationType) return "Type d'évaluation requis.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile ||
    !["admin", "professeur", "censeur"].includes(profile.role) ||
    !profile.establishment_id
  ) {
    return "Action non autorisée.";
  }

  const rows = entries
    .filter((e) => Number.isFinite(e.score) && e.score >= 0 && (e.maxScore ?? 20) > 0)
    .map((e) => ({
      student_id: e.studentId,
      section_id: sectionId,
      recorded_by: user.id,
      subject: subject.trim(),
      evaluation_type: evaluationType,
      score: e.score,
      max_score: e.maxScore ?? 20,
      evaluation_date: evaluationDate ?? new Date().toISOString().slice(0, 10),
    }));

  if (rows.length === 0) return "Aucune note valide.";

  const { error } = await supabase.from("grades").insert(rows);
  if (error) return error.message;

  revalidatePath(`/dashboard/professeur/classe/${sectionId}`);
  revalidatePath("/dashboard/professeur");
  revalidatePath("/dashboard/parent");
  return null;
}

export async function bulkMarkAttendance(
  sectionId: string,
  entries: Array<{ studentId: string; present: boolean }>,
  sessionDate?: string
): Promise<string | null> {
  if (entries.length === 0) return "Aucune entrée.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Non authentifié.";

  const date = sessionDate ?? new Date().toISOString().slice(0, 10);
  const rows = entries.map((e) => ({
    student_id: e.studentId,
    section_id: sectionId,
    session_date: date,
    present: e.present,
    recorded_by: user.id,
  }));

  const { error } = await supabase
    .from("attendance_records")
    .upsert(rows, { onConflict: "student_id,session_date" });
  if (error) return error.message;

  revalidatePath(`/dashboard/professeur/classe/${sectionId}`);
  revalidatePath("/dashboard/parent");
  return null;
}