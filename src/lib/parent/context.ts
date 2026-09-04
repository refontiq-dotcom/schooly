import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentWithSection = {
  id: string;
  full_name: string;
  section_id: string;
  parent_phone: string;
  reservation_id: string | null;
  sections: {
    name: string;
    levels: {
      name: string;
      establishment_id: string;
      establishments: {
        id: string;
        name: string;
        city: string;
      };
    };
  } | null;
};

export type EstablishmentGroup = {
  establishment: {
    id: string;
    name: string;
    city: string;
  };
  students: StudentWithSection[];
};

/**
 * Get the parent's phone number from their profile or auth metadata.
 */
export async function getParentPhone(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // Try profile first
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.phone) return profile.phone;

  // Fallback: check auth user metadata
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.user_metadata?.phone ?? null;
}

/**
 * Find all students linked to this parent via parent_phone.
 * Also checks parent_id as fallback for legacy data.
 */
export async function findParentStudents(
  supabase: SupabaseClient,
  userId: string
): Promise<StudentWithSection[]> {
  const phone = await getParentPhone(supabase, userId);

  // Query by parent_phone (new system)
  let students: StudentWithSection[] = [];
  if (phone) {
    const { data } = await supabase
      .from("students")
      .select(
        `
        id, full_name, section_id, parent_phone,
        sections (
          name,
          levels (
            name, establishment_id,
            establishments ( id, name, city )
          )
        )
      `
      )
      .ilike("parent_phone", phone);

    students = (data as unknown as StudentWithSection[] ?? []);
  }

  // Fallback: also check parent_id (legacy data)
  if (students.length === 0) {
    const { data: legacyData } = await supabase
      .from("students")
      .select(
        `
        id, full_name, section_id, parent_phone,
        sections (
          name,
          levels (
            name, establishment_id,
            establishments ( id, name, city )
          )
        )
      `
      )
      .eq("parent_id", userId);

    const legacyStudents = (legacyData as unknown as StudentWithSection[] ?? []);
    // Merge, avoiding duplicates
    const existingIds = new Set(students.map((s) => s.id));
    for (const s of legacyStudents) {
      if (!existingIds.has(s.id)) {
        students.push(s);
      }
    }
  }

  return students;
}

/**
 * Group students by establishment.
 */
export function groupByEstablishment(
  students: StudentWithSection[]
): EstablishmentGroup[] {
  const map = new Map<
    string,
    { establishment: { id: string; name: string; city: string }; students: StudentWithSection[] }
  >();

  for (const student of students) {
    const level = student.sections?.levels;
    const est = level?.establishments;
    if (!est) continue;

    if (!map.has(est.id)) {
      map.set(est.id, { establishment: est, students: [] });
    }
    map.get(est.id)!.students.push(student);
  }

  return Array.from(map.values());
}

/**
 * Get a safe establishment ID from search params.
 * Falls back to the first available establishment if the ID is invalid.
 */
export function resolveEstablishmentId(
  groups: EstablishmentGroup[],
  searchParam: string | null
): string | null {
  if (!groups.length) return null;

  if (searchParam) {
    const found = groups.find((g) => g.establishment.id === searchParam);
    if (found) return found.establishment.id;
  }

  return groups[0].establishment.id;
}
