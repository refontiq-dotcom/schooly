"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SECTION_CAPACITY } from "@/lib/classes-intelligence/scoring";

function revalidateClassPaths(sectionId?: string) {
  revalidatePath("/dashboard/admin/classes");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/professeur");
  if (sectionId) {
    revalidatePath(`/dashboard/admin/classes/${sectionId}`);
    revalidatePath(`/dashboard/professeur/classe/${sectionId}`);
  }
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." as const, supabase, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, establishment_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    return { error: "Action réservée à l'administrateur." as const, supabase, profile: null };
  }

  return { error: null, supabase, profile };
}

export async function addLevel(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();
  if (!name) return "Nom du niveau requis.";
  if (!establishmentId) return "Établissement manquant.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  if (auth.profile!.establishment_id !== establishmentId) {
    return "Établissement non autorisé.";
  }

  const { data: existing } = await auth.supabase
    .from("levels")
    .select("rank")
    .eq("establishment_id", establishmentId)
    .order("rank", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rank = (existing?.rank ?? 0) + 1;
  const { error } = await auth.supabase.from("levels").insert({
    establishment_id: establishmentId,
    name,
    rank,
  });
  if (error) return error.message;

  revalidateClassPaths();
  return null;
}

export async function addSection(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const levelId = String(formData.get("level_id") ?? "").trim();
  const capacityRaw = Number(formData.get("capacity") ?? DEFAULT_SECTION_CAPACITY);
  const capacity = Number.isFinite(capacityRaw) ? Math.floor(capacityRaw) : 0;

  if (!name) return "Nom de la section requis.";
  if (!levelId) return "Niveau manquant.";
  if (capacity <= 0) return "Capacité invalide.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data: level } = await auth.supabase
    .from("levels")
    .select("id, establishment_id")
    .eq("id", levelId)
    .maybeSingle();
  if (!level || level.establishment_id !== auth.profile!.establishment_id) {
    return "Niveau introuvable.";
  }

  const { error } = await auth.supabase.from("sections").insert({
    level_id: levelId,
    name,
    capacity,
  });
  if (error) return error.message;

  revalidateClassPaths();
  return null;
}

export async function updateSectionCapacity(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const sectionId = String(formData.get("section_id") ?? "").trim();
  const capacityRaw = Number(formData.get("capacity") ?? 0);
  const capacity = Number.isFinite(capacityRaw) ? Math.floor(capacityRaw) : 0;

  if (!sectionId) return "Section manquante.";
  if (capacity <= 0) return "Capacité invalide.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data: section } = await auth.supabase
    .from("sections")
    .select("id, seats_taken, level_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (!section) return "Section introuvable.";

  const { data: level } = await auth.supabase
    .from("levels")
    .select("establishment_id")
    .eq("id", section.level_id)
    .maybeSingle();
  if (!level || level.establishment_id !== auth.profile!.establishment_id) {
    return "Section non autorisée.";
  }
  if (capacity < section.seats_taken) {
    return `Capacité trop basse : ${section.seats_taken} élève(s) déjà inscrits.`;
  }

  const { error } = await auth.supabase
    .from("sections")
    .update({ capacity })
    .eq("id", sectionId);
  if (error) return error.message;

  revalidateClassPaths(sectionId);
  return null;
}

export async function assignTeacher(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const sectionId = String(formData.get("section_id") ?? "").trim();
  const teacherId = String(formData.get("teacher_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!sectionId) return "Section manquante.";
  if (!teacherId) return "Professeur requis.";
  if (!subject) return "Matière requise.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data: teacher } = await auth.supabase
    .from("profiles")
    .select("id, role, establishment_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher || teacher.establishment_id !== auth.profile!.establishment_id) {
    return "Professeur introuvable.";
  }
  if (teacher.role !== "professeur") {
    return "Seuls les professeurs peuvent être affectés à une classe.";
  }

  const { error } = await auth.supabase.from("teacher_assignments").insert({
    teacher_id: teacherId,
    section_id: sectionId,
    subject,
  });
  if (error) {
    if (error.code === "23505") return "Ce professeur est déjà affecté à cette matière.";
    return error.message;
  }

  revalidateClassPaths(sectionId);
  return null;
}

export async function unassignTeacher(assignmentId: string, sectionId: string): Promise<string | null> {
  if (!assignmentId) return "Affectation manquante.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { error } = await auth.supabase
    .from("teacher_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return error.message;

  revalidateClassPaths(sectionId);
  return null;
}

export async function setHomeroomTeacher(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const sectionId = String(formData.get("section_id") ?? "").trim();
  const teacherIdRaw = String(formData.get("teacher_id") ?? "").trim();
  const teacherId = teacherIdRaw.length > 0 ? teacherIdRaw : null;

  if (!sectionId) return "Section manquante.";

  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  if (teacherId) {
    const { data: teacher } = await auth.supabase
      .from("profiles")
      .select("id, role, establishment_id")
      .eq("id", teacherId)
      .maybeSingle();
    if (!teacher || teacher.establishment_id !== auth.profile!.establishment_id) {
      return "Professeur introuvable.";
    }
    if (teacher.role !== "professeur") {
      return "Le titulaire doit être un professeur.";
    }
  }

  const { error } = await auth.supabase
    .from("sections")
    .update({ homeroom_teacher_id: teacherId })
    .eq("id", sectionId);
  if (error) return error.message;

  revalidateClassPaths(sectionId);
  return null;
}

export async function seedPresetLevels(): Promise<string | null> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase.rpc("seed_preset_levels_for_establishment", {
    p_establishment_id: auth.profile!.establishment_id,
  });
  if (error) return error.message;
  if (data === 0) return "Aucun niveau à créer (déjà configurés ou type d'établissement manquant).";

  revalidateClassPaths();
  return null;
}
