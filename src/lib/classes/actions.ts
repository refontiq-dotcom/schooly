"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/* Gestion des classes (admin) — sections, affectations, effectif      */
/* ------------------------------------------------------------------ */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    return { supabase, error: "Action réservée à l'administrateur." };
  }
  return { supabase, establishmentId: profile.establishment_id as string, error: null };
}

/** Vérifie que la section appartient bien à l'établissement de l'admin. */
async function sectionBelongsToEstablishment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sectionId: string,
  establishmentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("sections")
    .select("id, levels!inner(establishment_id)")
    .eq("id", sectionId)
    .maybeSingle();
  if (!data) return false;
  const level = data.levels as unknown as { establishment_id: string } | null;
  return level?.establishment_id === establishmentId;
}

export async function updateSection(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const sectionId = String(formData.get("section_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = Number(formData.get("capacity"));
  const homeroom = String(formData.get("homeroom_teacher_id") ?? "").trim();

  if (!sectionId) return "Section manquante.";
  if (!name) return "Nom requis.";
  if (!Number.isFinite(capacity) || capacity <= 0) return "Capacité invalide.";

  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase, establishmentId } = ctx;

  if (!(await sectionBelongsToEstablishment(supabase, sectionId, establishmentId!))) {
    return "Section hors de votre établissement.";
  }

  const { data: current } = await supabase
    .from("sections")
    .select("seats_taken")
    .eq("id", sectionId)
    .maybeSingle();
  if (!current) return "Section introuvable.";
  if (capacity < current.seats_taken) {
    return `Capacité trop basse : ${current.seats_taken} élèves déjà inscrits.`;
  }

  const { error } = await supabase
    .from("sections")
    .update({
      name,
      capacity,
      homeroom_teacher_id: homeroom || null,
    })
    .eq("id", sectionId);
  if (error) return error.message;

  revalidatePath(`/dashboard/admin/classes/${sectionId}`);
  revalidatePath("/dashboard/admin/classes");
  return null;
}

export async function deleteSection(sectionId: string): Promise<string | null> {
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase, establishmentId } = ctx;

  if (!(await sectionBelongsToEstablishment(supabase, sectionId, establishmentId!))) {
    return "Section hors de votre établissement.";
  }

  const { data: current } = await supabase
    .from("sections")
    .select("seats_taken")
    .eq("id", sectionId)
    .maybeSingle();
  if (!current) return "Section introuvable.";
  if (current.seats_taken > 0) {
    return "Impossible de supprimer : des élèves y sont inscrits. Transférez-les d'abord.";
  }

  const { error } = await supabase.from("sections").delete().eq("id", sectionId);
  if (error) return error.message;

  revalidatePath("/dashboard/admin/classes");
  return null;
}

export async function assignTeacher(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const sectionId = String(formData.get("section_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();

  if (!sectionId || !teacherId || !subject) {
    return "Professeur et matière requis.";
  }

  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase, establishmentId } = ctx;

  if (!(await sectionBelongsToEstablishment(supabase, sectionId, establishmentId!))) {
    return "Section hors de votre établissement.";
  }

  const { data: teacher } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", teacherId)
    .eq("role", "professeur")
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (!teacher) return "Professeur introuvable dans votre établissement.";

  const { error } = await supabase.from("teacher_assignments").upsert(
    { teacher_id: teacherId, section_id: sectionId, subject },
    { onConflict: "teacher_id,section_id,subject" }
  );
  if (error) return error.message;

  revalidatePath(`/dashboard/admin/classes/${sectionId}`);
  revalidatePath("/dashboard/admin/classes");
  return null;
}

export async function removeTeacherAssignment(assignmentId: string): Promise<string | null> {
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase } = ctx;

  const { error } = await supabase
    .from("teacher_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return error.message;

  revalidatePath("/dashboard/admin/classes");
  return null;
}

export async function transferStudent(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const studentId = String(formData.get("student_id") ?? "");
  const targetSectionId = String(formData.get("target_section_id") ?? "");

  if (!studentId || !targetSectionId) return "Élève et classe cible requis.";

  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase, establishmentId } = ctx;

  if (!(await sectionBelongsToEstablishment(supabase, targetSectionId, establishmentId!))) {
    return "Classe cible hors de votre établissement.";
  }

  const { data: target } = await supabase
    .from("sections")
    .select("capacity, seats_taken")
    .eq("id", targetSectionId)
    .maybeSingle();
  if (!target) return "Classe cible introuvable.";
  if (target.seats_taken >= target.capacity) {
    return "Classe cible complète.";
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, section_id")
    .eq("id", studentId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (!student) return "Élève introuvable.";
  if (student.section_id === targetSectionId) {
    return "L'élève est déjà dans cette classe.";
  }

  // Décrémente l'ancienne, incrémente la nouvelle, en toute atomicité côté SQL.
  const { error: decError } = await supabase.rpc("decrement_section_seats", {
    p_section_id: student.section_id,
  });
  if (decError) return decError.message;

  const { error: moveError } = await supabase
    .from("students")
    .update({ section_id: targetSectionId })
    .eq("id", studentId);
  if (moveError) {
    // Rollback best-effort
    await supabase.rpc("increment_section_seats", { p_section_id: student.section_id });
    return moveError.message;
  }

  const { error: incError } = await supabase.rpc("increment_section_seats", {
    p_section_id: targetSectionId,
  });
  if (incError) return incError.message;

  revalidatePath(`/dashboard/admin/classes/${targetSectionId}`);
  revalidatePath("/dashboard/admin/classes");
  return null;
}

export async function removeStudent(studentId: string, sectionId: string): Promise<string | null> {
  const ctx = await requireAdmin();
  if (ctx.error) return ctx.error;
  const { supabase, establishmentId } = ctx;

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (!student) return "Élève introuvable.";

  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) return error.message;

  await supabase.rpc("decrement_section_seats", { p_section_id: sectionId });

  revalidatePath(`/dashboard/admin/classes/${sectionId}`);
  revalidatePath("/dashboard/admin/classes");
  return null;
}
