// Types partagés du module structure académique : source unique pour les
// onglets extraits (years, levels, classes, subjects, matrix) — évite les
// doublons locaux qui divergeaient à chaque migration (cf. pedagogie).
export type AcademicYear = { id: string; label: string; status: string }
export type GradeLevel = { id: string; name: string; level: number; cycle: string }
export type ClassItem = {
  id: string
  name: string
  capacity: number | null
  head_teacher_id?: string | null
  grade_levels?: { name: string }
  users?: { full_name: string }
}
export type Subject = { id: string; name: string; code: string | null; coefficient: number }
export type Assignment = {
  id: string
  classes?: { name: string }
  subjects?: { name: string }
  coefficient: number
  teacher_id?: string | null
  users?: { full_name: string }
}
export type Teacher = { id: string; full_name: string }

export const STRUCTURE_TABS = ["years", "levels", "classes", "subjects", "matrix", "rollover"] as const
export type StructureTab = (typeof STRUCTURE_TABS)[number]

export const MATRIX_TAB: StructureTab = "matrix"
