/**
 * Logique d'intelligence pour le module Professeur — implémentation TypeScript
 * miroir des fonctions/vues Postgres du même nom.
 *
 * Cette couche permet :
 *   1. d'afficher des scores/prédictions optimistes côté client ;
 *   2. de tester les invariants sans Postgres ;
 *   3. de documenter la règle métier.
 *
 * La valeur de référence reste Postgres (utilisée par les vues SQL). Ce
 * miroir TypeScript doit rester synchronisé.
 */

export const RISK_THRESHOLDS = {
  DROP_RATIO: 0.30,
  ABSENCES_DAYS: 14,
  ABSENCES_MIN: 3,
  BEHAVIOR_KINDS: ["a_surveiller", "incident"] as const,
  BEHAVIOR_MIN: 2,
  LOW_AVERAGE_THRESHOLD: 8,
  GRADE_RECENT_DAYS: 30,
  GRADE_LOOKBACK_DAYS: 60,
  PREDICTION_HORIZON: 3,
} as const;

export type RiskLevel = "low" | "medium" | "high";
export type GradeBucket = "excellent" | "bien" | "moyen" | "fragile" | "critique";

export interface StudentSignals {
  latestScore: number | null;
  previousScore: number | null;
  /** Nombre d'absences non justifiées sur 14 jours */
  recentAbsences: number;
  /** Nombre de notes "a_surveiller" ou "incident" sur 30 jours */
  behaviorCount: number;
  /** Moyenne des notes sur 30 jours (0..20) */
  currentAverage: number | null;
}

export function computeRiskLevel(signals: StudentSignals): RiskLevel {
  const drop =
    signals.latestScore !== null &&
    signals.previousScore !== null &&
    signals.previousScore > 0 &&
    (signals.previousScore - signals.latestScore) / signals.previousScore >=
      RISK_THRESHOLDS.DROP_RATIO;

  const absences = signals.recentAbsences >= RISK_THRESHOLDS.ABSENCES_MIN;
  const behavior = signals.behaviorCount >= RISK_THRESHOLDS.BEHAVIOR_MIN;
  const low =
    signals.currentAverage !== null &&
    signals.currentAverage < RISK_THRESHOLDS.LOW_AVERAGE_THRESHOLD;

  const triggers = [drop, absences, behavior, low].filter(Boolean).length;

  if (triggers >= 2) return "high";
  if (triggers >= 1) return "medium";
  return "low";
}

/** Normalise une note brute vers /20. */
export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.max(0, Math.min(20, (score / maxScore) * 20));
}

/** Calcule la moyenne d'un ensemble de notes normalisées /20. */
export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

/** Médiane d'un ensemble de notes. */
export function medianScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Écart-type (population). */
export function stdDeviation(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = averageScore(scores);
  const variance =
    scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

export interface DistributionInput {
  scores: number[];
}

export interface DistributionResult {
  excellent: number;
  bien: number;
  moyen: number;
  fragile: number;
  critique: number;
}

export function distributeGrades({ scores }: DistributionInput): DistributionResult {
  const result: DistributionResult = {
    excellent: 0,
    bien: 0,
    moyen: 0,
    fragile: 0,
    critique: 0,
  };
  for (const s of scores) {
    const n = normalizeScore(s, 20);
    if (n >= 16) result.excellent++;
    else if (n >= 14) result.bien++;
    else if (n >= 10) result.moyen++;
    else if (n >= 8) result.fragile++;
    else result.critique++;
  }
  return result;
}

export interface PredictionInput {
  scoresOrdered: number[]; // du plus ancien au plus récent
  horizon?: number;        // nb d'évaluations à projeter (défaut 3)
}

/**
 * Prédit la moyenne future via régression linéaire simple sur la séquence.
 * Si < 2 notes, retourne simplement la moyenne actuelle.
 */
export function predictAverage({ scoresOrdered, horizon = RISK_THRESHOLDS.PREDICTION_HORIZON }: PredictionInput): number {
  if (scoresOrdered.length === 0) return 0;
  const mean = averageScore(scoresOrdered);
  if (scoresOrdered.length < 2) return round1(mean);

  // Tendance = moyenne des deltas consécutifs
  const deltas: number[] = [];
  for (let i = 1; i < scoresOrdered.length; i++) {
    deltas.push(scoresOrdered[i] - scoresOrdered[i - 1]);
  }
  const trend = averageScore(deltas);
  return round1(Math.max(0, Math.min(20, mean + trend * horizon)));
}

/** Détermine le bucket d'une note normalisée. */
export function gradeBucket(score: number): GradeBucket {
  if (score >= 16) return "excellent";
  if (score >= 14) return "bien";
  if (score >= 10) return "moyen";
  if (score >= 8) return "fragile";
  return "critique";
}

export const GRADE_BUCKET_LABEL: Record<GradeBucket, string> = {
  excellent: "Excellent (≥16)",
  bien: "Bien (14-16)",
  moyen: "Moyen (10-14)",
  fragile: "Fragile (8-10)",
  critique: "Critique (<8)",
};

export const GRADE_BUCKET_COLOR: Record<GradeBucket, string> = {
  excellent: "bg-emerald-500",
  bien: "bg-emerald-300",
  moyen: "bg-amber-500",
  fragile: "bg-orange-500",
  critique: "bg-red-500",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Suivi normal",
  medium: "À surveiller",
  high: "Décrochage probable",
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}