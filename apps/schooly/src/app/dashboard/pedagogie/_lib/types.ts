// Types partagés par le hub pédagogie (vue + sections).
//
// Les lignes de données (séances, devoirs, décisions) sont ré-exportées depuis
// ./actions : le serveur reste la source unique, fidèle au schéma (embeds
// nullables). Les types d'options ne concernent que les formulaires.
import type {
  AcademicDecisionRow,
  CourseSessionRow,
  HomeworkRow,
} from "../actions"

/** Ré-export de la ligne d'inscription (source unique : `./actions`). */
export type { EnrollmentListRow } from "../actions"

export type SessionRow = CourseSessionRow
export type HomeworkListRow = HomeworkRow
export type DecisionRow = AcademicDecisionRow

export type ClassOption = { id: string; name: string }
export type SubjectOption = { id: string; name: string }
export type TeacherOption = { id: string; full_name: string }
export type YearOption = { id: string; label: string; status: string }
export type EnrollmentOption = { id: string; label: string }

/**
 * Rôle porté par la session utilisateur. Volontairement large (`string`) :
 * c'est aujourd'hui le rôle Postgres de la session Supabase — voir la note
 * sur les gardes d'affichage dans ./helpers.ts.
 */
export type UserRole = string | null | undefined

/** Navigation déclenchée par un item de guidance pédagogique. */
export type GuidanceAction = "open-structure" | "scroll-to-sessions"

/**
 * Item de guidance pédagogique **sans callback** : condition métier + action
 * déclarative. La vue traduit `action` en navigation — la logique de règles
 * reste ainsi testable sans DOM ni router.
 */
export type PedagogieGuidanceItem = {
  id: string
  title: string
  description: string
  severity: "critical" | "warning" | "action" | "info"
  actionLabel?: string
  action?: GuidanceAction
}

/** Signaux métier qui déclenchent la guidance du hub. */
export type PedagogieSignals = {
  hasCurrentYear: boolean
  plannedYearLabel: string | null
  classesCount: number
  subjectsCount: number
  sessionsCount: number
}

/** Descripteur de rendu d'un badge de décision du conseil de classe. */
export type DecisionBadge = {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  className?: string
}
