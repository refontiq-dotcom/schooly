/**
 * Logique d'intelligence pour le module Parent — implémentation TypeScript
 * miroir des fonctions/vues Postgres du même nom.
 */

import { normalizeScore, averageScore } from "../teacher-intelligence/scoring";

export interface ChildSummary {
  studentId: string;
  fullName: string;
  levelName: string | null;
  sectionName: string | null;
  currentAverage: number;
  gradesCount: number;
  attendancePct: number | null;
  recentAbsences: number;
  feesRemaining: number;
  feesOverdueCount: number;
  docsMissingCount: number;
  behaviorConcernsCount: number;
  hasRecentDrop: boolean;
  parentSatisfactionScore: number;
}

export type AlertType =
  | "grade_drop"
  | "absences"
  | "low_attendance"
  | "fees_overdue"
  | "docs_missing"
  | "behavior"
  | "excellence";

export type AlertSeverity = "low" | "medium" | "high" | "positive";

export interface ParentAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
}

export const ALERT_LABEL: Record<AlertType, string> = {
  grade_drop: "Baisse de moyenne",
  absences: "Absences répétées",
  low_attendance: "Assiduité faible",
  fees_overdue: "Frais en retard",
  docs_missing: "Documents manquants",
  behavior: "Suivi comportement",
  excellence: "Excellent travail",
};

export const ALERT_ICON: Record<AlertType, string> = {
  grade_drop: "📉",
  absences: "🚫",
  low_attendance: "📅",
  fees_overdue: "💸",
  docs_missing: "📄",
  behavior: "⚠️",
  excellence: "🌟",
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-800",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

/** Construit la liste d alertes à partir d'une synthèse enfant. */
export function buildParentAlerts(summary: ChildSummary): ParentAlert[] {
  const alerts: ParentAlert[] = [];

  if (summary.hasRecentDrop) {
    alerts.push({
      type: "grade_drop",
      severity: "high",
      title: "Baisse de moyenne",
      message:
        "La moyenne des 2 dernières notes a baissé de plus de 30% par rapport aux 2 précédentes.",
    });
  }

  if (summary.recentAbsences >= 3) {
    alerts.push({
      type: "absences",
      severity: "high",
      title: "Absences répétées",
      message: `${summary.recentAbsences} absences non justifiées sur les 14 derniers jours.`,
    });
  }

  if (summary.attendancePct !== null && summary.attendancePct < 75) {
    alerts.push({
      type: "low_attendance",
      severity: "medium",
      title: "Assiduité faible",
      message: `Taux de présence de ${summary.attendancePct}% sur 30 jours.`,
    });
  }

  if (summary.feesOverdueCount > 0) {
    alerts.push({
      type: "fees_overdue",
      severity: "high",
      title: "Frais en retard",
      message: `${summary.feesOverdueCount} échéance(s) en retard, total ${Math.round(summary.feesRemaining)} FCFA.`,
    });
  }

  if (summary.docsMissingCount > 0) {
    alerts.push({
      type: "docs_missing",
      severity: "medium",
      title: "Documents manquants",
      message: `${summary.docsMissingCount} document(s) obligatoire(s) non déposés.`,
    });
  }

  if (summary.behaviorConcernsCount >= 2) {
    alerts.push({
      type: "behavior",
      severity: "medium",
      title: "Suivi comportement",
      message: `${summary.behaviorConcernsCount} signalements "à surveiller/incident" sur 30 jours.`,
    });
  }

  if (summary.currentAverage > 0 && summary.currentAverage >= 16) {
    alerts.push({
      type: "excellence",
      severity: "positive",
      title: "Excellent travail !",
      message: `Moyenne de ${summary.currentAverage}/20. Continuez ainsi.`,
    });
  }

  return alerts;
}

/** Calcule le score de satisfaction parent (0..50) à partir des KPIs.
 *  Le miroir exact de la vue SQL `parent_dashboard_summary.parent_satisfaction_score`,
 *  qui plafonne à 50 (les bonus sont divisés par 2).
 */
export function computeParentSatisfaction(input: {
  attendancePct: number | null;
  currentAverage: number;
  feesOverdueCount: number;
  docsMissingCount: number;
  behaviorConcernsCount: number;
}): number {
  const attendance = input.attendancePct ?? 70;
  const averageBonus = Math.min(40, Math.max(0, input.currentAverage * 2));
  const feesOk = input.feesOverdueCount === 0 ? 20 : 0;
  const docsOk = input.docsMissingCount === 0 ? 10 : 0;
  const behaviorPenalty = input.behaviorConcernsCount * 5;

  const raw = attendance + averageBonus + feesOk + docsOk - behaviorPenalty;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped / 2);
}

/** Génère un texte WhatsApp prêt à partager (sans caractères spéciaux comme les sauts). */
export function generateWhatsAppSummary(input: {
  fullName: string;
  levelName: string | null;
  sectionName: string | null;
  currentAverage: number;
  attendancePct: number | null;
  rankInSection: number | null;
  sectionSize: number;
  feesRemaining: number;
  feesOverdueCount: number;
  docsMissingCount: number;
}): string {
  const lines: string[] = [];
  lines.push(
    `📚 *${input.fullName}* — ${input.levelName ?? ""} / ${input.sectionName ?? ""}`
  );

  if (input.currentAverage > 0) {
    lines.push(`🎯 Moyenne : *${input.currentAverage.toFixed(2)}/20*`);
  }

  if (input.attendancePct !== null) {
    lines.push(`📅 Assiduité 30j : *${input.attendancePct}%*`);
  }

  if (input.rankInSection !== null && input.sectionSize > 0) {
    lines.push(
      `🏆 Rang : *${input.rankInSection}e / ${input.sectionSize}*`
    );
  }

  if (input.feesRemaining > 0) {
    const suffix =
      input.feesOverdueCount > 0
        ? ` (⚠️ ${input.feesOverdueCount} en retard)`
        : "";
    lines.push(`💰 Restant : *${Math.round(input.feesRemaining)} FCFA*${suffix}`);
  }

  if (input.docsMissingCount > 0) {
    lines.push(`📄 Documents manquants : *${input.docsMissingCount}*`);
  }

  return lines.join("\n");
}

/** Détermine si la synthèse est "toute verte" (aucune alerte). */
export function isChildHealthy(summary: ChildSummary): boolean {
  return buildParentAlerts(summary).filter((a) => a.severity !== "positive").length === 0;
}

/** Réutilise la logique de normalisation du module professeur. */
export { normalizeScore, averageScore };