// apps/schooly/src/app/dashboard/pedagogie/grades/_lib/data.ts
//
// Chargement des données d'évaluation, sorti de la page pour que les trois
// écrans (hub, saisie, bulletins) partagent la même source.
//
// Règle du projet : immuabilité. `loadEvaluationSnapshot()` ne conserve aucun
// état partagé — elle renvoie un instantané neuf à chaque appel, ce qui évite
// qu'un écran laisse fuiter des données vers un autre (l'ancien store mutable
// exposait un cache non invalidé après rechargement).
import {
  getAcademicYearsForSchool,
  getClassesForSchool,
  getSubjectsForSchool,
  getEnrollmentsForSchool,
  getGradeEntries,
  type GradeEntryRow,
  type EnrollmentListRow,
} from "../../actions"
import { getEvaluationConfiguration, getEvaluationAssessments } from "../../evaluation-actions"
import type { EvaluationRule, EvaluationPeriod, EvaluationAssessment } from "../../evaluation-types"

export interface EvaluationSnapshot {
  rules: EvaluationRule[]
  periods: EvaluationPeriod[]
  years: { id: string; label: string }[]
  classes: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
  enrollments: EnrollmentListRow[]
  grades: GradeEntryRow[]
  assessments: EvaluationAssessment[]
}

// Union discriminée par `error` : permet au consommateur de rétrécir le type
// (`if (result.error)` garantit `data`, et inversement) sans assertion.
export type SnapshotResult =
  | { data: EvaluationSnapshot; error: undefined }
  | { data: undefined; error: string }

/** Période ouverte à la saisie : non clôturée et incluse dans la fenêtre courante. */
export function isPeriodOpen(period: EvaluationPeriod, now: number = Date.now()): boolean {
  if (period.locked_at) return false
  return now >= Date.parse(period.starts_at) && now < Date.parse(period.ends_at)
}

/** Une note n'est corrigeable que si elle est rattachée à une période ouverte. */
export function isGradeEditable(
  grade: Pick<GradeEntryRow, "assessment_id" | "period_id">,
  periods: EvaluationPeriod[],
  now: number = Date.now(),
): boolean {
  if (!grade.assessment_id) return false
  return periods.some((p) => p.id === grade.period_id && isPeriodOpen(p, now))
}

/** Lit toutes les sources en parallèle et les agrège, sans état conservé. */
export async function loadEvaluationSnapshot(): Promise<SnapshotResult> {
  const [configuration, yearRes, classRes, subjectRes, enrollmentRes, gradeRes, assessmentRes] =
    await Promise.all([
      getEvaluationConfiguration(),
      getAcademicYearsForSchool(),
      getClassesForSchool(),
      getSubjectsForSchool(),
      getEnrollmentsForSchool(),
      getGradeEntries(),
      getEvaluationAssessments(),
    ])

  const error =
    configuration.error ??
    yearRes.error ??
    classRes.error ??
    subjectRes.error ??
    enrollmentRes.error ??
    gradeRes.error ??
    assessmentRes.error
  if (error) return { data: undefined, error }

  // Copies neuves : les listes viennent d'un cache partagé par les trois écrans.
  // Les exposer telles quelles laisserait un écran muter les données d'un autre.
  return {
    data: {
      rules: [...(configuration.data?.rules ?? [])],
      periods: [...(configuration.data?.periods ?? [])],
      years: [...(yearRes.data ?? [])],
      classes: [...(classRes.data ?? [])],
      subjects: [...(subjectRes.data ?? [])],
      enrollments: [...(enrollmentRes.data ?? [])],
      grades: [...(gradeRes.data ?? [])],
      assessments: [...((assessmentRes.data ?? []) as EvaluationAssessment[])],
    },
    // `error: undefined` explicite : c'est le discriminant de l'union, sans lui
    // TypeScript ne peut pas rétrécir le type côté consommateur.
    error: undefined,
  }
}
