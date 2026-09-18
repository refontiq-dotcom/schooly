import type { SupabaseClient } from "@supabase/supabase-js"
import { seatsAvailable, type GradeLevelRow } from "./reinscription"

/**
 * Accès aux données de la réinscription en ligne (côté serveur).
 *
 * Facteur commun des routes `/api/v1/public/ecoles/[id]/reinscription/check`
 * et `/confirm` : la capacité d'un niveau se calcule à partir de la SOMME des
 * `classes.capacity` du niveau (le référentiel `grade_levels` n'a pas de
 * colonne de capacité) — même règle que la route `availability` déjà consommée
 * par Trouvetou, pour que les deux endpoints ne divergent jamais.
 */

export type LevelWithSeats = GradeLevelRow & {
  capacite: number
  inscrits: number
  places_disponibles: number
}

export type GuardianRow = {
  id: string
  full_name: string
  phone: string
}

export type ChildRow = {
  student_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  /** Niveau actuel déduit de la dernière inscription connue (rang + libellé). */
  current_level: GradeLevelRow | null
  /** Classe libre déclarée (utilisée si l'élève n'a pas d'inscription en base). */
  previous_class: string | null
  matricule: string | null
}

/** Statuts d'inscription considérés comme « élève présent dans l'école ». */
const LIVE_STATUSES = ["confirmed", "active"]

/**
 * Niveaux de l'école avec leur remplissage réel.
 *
 * Les inscrits sont comptés par niveau (tous statuts vivants), la capacité est
 * la somme des classes du niveau. Un niveau sans classe a 0 place : il ne doit
 * pas être proposé à la réinscription (sinon la demande ne pourra jamais être
 * honorée faute de classe d'accueil).
 */
export async function loadLevelsWithSeats(
  supabase: SupabaseClient,
  schoolId: string
): Promise<LevelWithSeats[]> {
  const { data: levels } = await supabase
    .from("grade_levels")
    .select("id, name, level")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level", { ascending: true })

  if (!levels || levels.length === 0) return []

  const levelIds = levels.map((l) => l.id as string)

  const { data: classRows } = await supabase
    .from("classes")
    .select("grade_level_id, capacity")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .in("grade_level_id", levelIds)

  const capacityByLevel: Record<string, number> = {}
  for (const row of classRows ?? []) {
    const key = row.grade_level_id as string
    capacityByLevel[key] = (capacityByLevel[key] ?? 0) + ((row.capacity as number | null) ?? 0)
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("grade_level_id")
    .eq("school_id", schoolId)
    .in("status", LIVE_STATUSES)
    .is("deleted_at", null)
    .in("grade_level_id", levelIds)

  const enrolledByLevel: Record<string, number> = {}
  for (const row of enrollments ?? []) {
    const key = row.grade_level_id as string
    if (!key) continue
    enrolledByLevel[key] = (enrolledByLevel[key] ?? 0) + 1
  }

  return levels.map((l) => {
    const id = l.id as string
    const capacite = capacityByLevel[id] ?? 0
    const inscrits = enrolledByLevel[id] ?? 0
    return {
      id,
      name: l.name as string,
      level: l.level as number,
      capacite,
      inscrits,
      places_disponibles: seatsAvailable(capacite, inscrits),
    }
  })
}

/**
 * Parents correspondant à un numéro, en format canonique.
 *
 * Passe par `phone_norm` (migration 20260918160000) et JAMAIS par `phone` :
 * la colonne brute contient des formats hétérogènes selon le canal de saisie.
 * Renvoie un tableau vide si le numéro est inconnu — l'appelant décide du 404.
 */
export async function findGuardiansByPhone(
  supabase: SupabaseClient,
  phoneNorm: string
): Promise<GuardianRow[]> {
  const { data } = await supabase
    .from("guardians")
    .select("id, full_name, phone")
    .eq("phone_norm", phoneNorm)
    .is("deleted_at", null)

  return (data ?? []) as GuardianRow[]
}

/**
 * Enfants déjà inscrits dans CETTE école pour les parents fournis.
 *
 * Le lien élève ⇄ parent n'existe pas sur `students` : il passe par
 * `enrollments.guardian_id`. On ne remonte que les inscriptions vivantes de
 * l'école, puis on déduplique par élève en gardant la plus récente — un élève
 * qui a fait 3 années dans l'école ne doit apparaître qu'une fois.
 */
export async function loadChildren(
  supabase: SupabaseClient,
  schoolId: string,
  guardianIds: readonly string[]
): Promise<ChildRow[]> {
  if (guardianIds.length === 0) return []

  const { data } = await supabase
    .from("enrollments")
    .select("id, student_id, matricule, created_at, grade_level_id, students(id, first_name, last_name, date_of_birth, previous_class), grade_levels(id, name, level)")
    .eq("school_id", schoolId)
    .in("guardian_id", guardianIds)
    .in("status", LIVE_STATUSES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const seen = new Set<string>()
  const children: ChildRow[] = []

  for (const row of data ?? []) {
    const studentId = row.student_id as string | null
    if (!studentId || seen.has(studentId)) continue
    seen.add(studentId)

    const student = (row.students ?? null) as
      | {
          first_name?: string
          last_name?: string
          date_of_birth?: string | null
          previous_class?: string | null
        }
      | null

    const level = (row.grade_levels ?? null) as
      | { id?: string; name?: string; level?: number }
      | null

    children.push({
      student_id: studentId,
      first_name: student?.first_name ?? "",
      last_name: student?.last_name ?? "",
      date_of_birth: student?.date_of_birth ?? null,
      current_level:
        level?.id && level.name != null && level.level != null
          ? { id: level.id, name: level.name, level: level.level }
          : null,
      previous_class: student?.previous_class ?? null,
      matricule: (row.matricule as string | null) ?? null,
    })
  }

  return children
}
