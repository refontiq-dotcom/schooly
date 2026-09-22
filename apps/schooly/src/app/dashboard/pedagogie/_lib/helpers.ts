// Logique pure du hub pédagogie : formatage d'affichage, construction des
// options de formulaire, règles de guidance et gardes d'affichage des
// modales. Aucun import React/DOM ici — tout est testable unitairement.
import type {
  DecisionBadge,
  EnrollmentListRow,
  EnrollmentOption,
  PedagogieGuidanceItem,
  PedagogieSignals,
  SessionRow,
  UserRole,
} from "./types"

/** Nom affiché d'un élève : « Aya Kouadio », « Élève » si l'identité manque. */
export function studentDisplayName(
  student: { first_name: string | null; last_name: string | null } | null | undefined,
): string {
  const parts = [student?.first_name, student?.last_name].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  return parts.length > 0 ? parts.join(" ") : "Élève"
}

/** Jour court d'une séance : « lun. 12 janv. ». */
export function formatSessionDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

/** Plage horaire d'une séance : « 07:10 — 08:00 ». */
export function sessionTimeRange(startsAt: string, endsAt: string): string {
  return `${startsAt.slice(11, 16)} — ${endsAt.slice(11, 16)}`
}

/** Échéance d'un devoir en toutes lettres : « vendredi 16 janvier ». */
export function formatDeadline(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

/**
 * Date courte (« 15/01/2026 ») ou tiret cadratin si la valeur est absente ou
 * illisible — `decided_at` peut arriver vide depuis une migration ancienne.
 */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("fr-FR")
}

/**
 * Options du sélecteur d'élèves (décision du conseil de classe) :
 * « Kouadio Aya — 6e B ». Le nom précède le prénom car la liste arrive déjà
 * triée par nom de famille côté serveur.
 */
export function buildEnrollmentOptions(rows: EnrollmentListRow[]): EnrollmentOption[] {
  return rows.map((row) => {
    const name = [row.students?.last_name, row.students?.first_name]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
    const className = row.classes?.name
    const label = [name || "Élève", className ? `— ${className}` : null]
      .filter(Boolean)
      .join(" ")
    return { id: row.id, label }
  })
}

/** Styles des décisions du conseil de classe (décision → badge). */
const DECISION_BADGES: Record<string, DecisionBadge> = {
  admitted: {
    label: "Admis",
    variant: "default",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  repeated: {
    label: "Redouble",
    variant: "secondary",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  excluded: { label: "Exclu", variant: "destructive" },
}
/**
 * Règles de guidance du hub : année active, classes, matières puis premier
 * cours. Chaque item décrit une action déclarative — la vue la traduit en
 * navigation (router ou défilement), ce module ne connaît ni router ni DOM.
 */
export function buildPedagogieGuidance(signals: PedagogieSignals): PedagogieGuidanceItem[] {
  const items: PedagogieGuidanceItem[] = []

  if (!signals.hasCurrentYear) {
    items.push({
      id: "year",
      title: "Aucune année académique n’est active",
      description: signals.plannedYearLabel
        ? `« ${signals.plannedYearLabel} » est prête à être activée.`
        : "Une année académique doit être créée et activée avant les opérations pédagogiques.",
      severity: "critical",
      actionLabel: signals.plannedYearLabel
        ? `Activer ${signals.plannedYearLabel}`
        : "Ouvrir la structure",
      action: "open-structure",
    })
  }

  if (signals.classesCount === 0) {
    items.push({
      id: "classes",
      title: "Aucune classe pédagogique n’est prête",
      description: "Créez ou vérifiez la structure académique avant de programmer des cours.",
      severity: "critical",
      actionLabel: "Préparer les classes",
      action: "open-structure",
    })
  }

  if (signals.subjectsCount === 0) {
    items.push({
      id: "subjects",
      title: "Aucune matière n’est configurée",
      description: "Les matières sont nécessaires pour construire les cours et les évaluations.",
      severity: "action",
      actionLabel: "Configurer les matières",
      action: "open-structure",
    })
  }

  if (
    signals.sessionsCount === 0 &&
    signals.hasCurrentYear &&
    signals.classesCount > 0 &&
    signals.subjectsCount > 0
  ) {
    items.push({
      id: "schedule",
      title: "Aucun cours n’est encore programmé",
      description:
        "La structure est prête : la prochaine étape logique est de programmer un premier cours.",
      severity: "action",
      actionLabel: "Programmer un cours",
      action: "scroll-to-sessions",
    })
  }

  return items
}

/**
 * Gardes d'**affichage** des modales d'écriture pédagogique.
 *
 * NOTE : le rôle passé ici provient de `useSupabaseUser().role`, qui est le
 * rôle Postgres de la session Supabase (« authenticated ») et non le rôle
 * métier de l'utilisateur. En l'état, ces gardes sont donc inopérantes : le
 * rôle métier devra être résolu depuis `user_school_roles` (chantier dédié).
 * Aucun risque d'écriture non autorisée : chaque server action est gardée par
 * `requireSchoolRole` côté serveur.
 */
export function canWriteTeachingContent(role: UserRole): boolean {
  return role === "professeur" || role === "direction"
}

/** Décisions du conseil : acte de direction (passage, redoublement, exclusion). */
export function canRecordDecision(role: UserRole): boolean {
  return role === "direction" || role === "super_admin"
}


/** Badge d'une décision ; toute valeur inconnue retombe sur « En attente ». */
export function decisionBadge(decision: string): DecisionBadge {
  return DECISION_BADGES[decision] ?? { label: "En attente", variant: "outline" }
}

/** Résumé d'une séance pour la liste : « 6e B — Mathématiques ». */
export function sessionTitle(session: SessionRow): string {
  return [session.classes?.name, session.subjects?.name].filter(Boolean).join(" — ") || "Séance"
}
