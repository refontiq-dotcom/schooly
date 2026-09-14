/**
 * Logique de scoring de risque d'impayé — implémentation TypeScript miroir
 * de la fonction Postgres `compute_payment_risk_score()`.
 *
 * Score 0..100 : 0 = très fiable, 100 = impayé quasi certain.
 */

export interface PaymentHistory {
  total: number;
  confirmed: number;
  failed: number;
  overdue: number;
  lateDaysAvg: number;
}

const NEUTRAL_RISK = 30;

export function computePaymentRiskScore(history: PaymentHistory): number {
  const { total, confirmed, failed, overdue, lateDaysAvg } = history;

  if (total === 0) {
    return NEUTRAL_RISK;
  }

  // Base : proportion d'échecs (failed + overdue)
  let score = Math.round((50 * (failed + overdue)) / total);

  // Bonus retard moyen (1 pt/jour, plafonné +20)
  score += Math.min(Math.round(lateDaysAvg), 20);

  // Bonus "aucun paiement confirmé" (très risqué)
  if (confirmed === 0) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

export interface PaymentAnomalyInput {
  amount: number;
  reference: string | null;
  studentId: string;
  paymentId: string;
  paidAt: Date | null;
  /** Paiements récents du même élève pour détecter les doublons */
  recentSameRefPayments: Array<{ id: string; amount: number; reference: string | null; createdAt: Date }>;
  /** Moyenne des paiements confirmés sur 90j dans l'établissement */
  averageConfirmedAmount: number | null;
  /** L'établissement du student_fee_id associé correspond-il ? */
  studentFeeEtabMatches: boolean;
}

export type PaymentAnomalyFlag =
  | "AMOUNT_OUTLIER"
  | "AMOUNT_INVALID"
  | "RAPID_DUPLICATE"
  | "REF_INVALID"
  | "STUDENT_BELONGS_TO_OTHER_ETAB";

export function detectPaymentAnomaly(input: PaymentAnomalyInput): PaymentAnomalyFlag[] {
  const flags: PaymentAnomalyFlag[] = [];

  if (input.amount <= 0) {
    flags.push("AMOUNT_INVALID");
  }

  if (
    input.averageConfirmedAmount !== null &&
    input.averageConfirmedAmount > 0 &&
    input.amount > input.averageConfirmedAmount * 5
  ) {
    flags.push("AMOUNT_OUTLIER");
  }

  if (input.reference !== null) {
    if (input.reference.length < 4 || input.reference.length > 64) {
      flags.push("REF_INVALID");
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const hasDup = input.recentSameRefPayments.some(
      (p) =>
        p.id !== input.paymentId &&
        p.reference === input.reference &&
        p.amount === input.amount &&
        p.createdAt > fiveMinAgo
    );
    if (hasDup) {
      flags.push("RAPID_DUPLICATE");
    }
  }

  if (!input.studentFeeEtabMatches) {
    flags.push("STUDENT_BELONGS_TO_OTHER_ETAB");
  }

  return flags;
}

/** Calcule le nombre de jours de retard entre une échéance et aujourd'hui. */
export function daysLate(dueDate: Date | null, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const diff = now.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export interface RemainingDue {
  amount: number;
  amountPaid: number;
}

export function remainingAmount(due: RemainingDue): number {
  return Math.max(0, due.amount - due.amountPaid);
}

export const ANOMALY_FLAG_LABEL: Record<PaymentAnomalyFlag, string> = {
  AMOUNT_OUTLIER: "Montant aberrant",
  AMOUNT_INVALID: "Montant invalide",
  RAPID_DUPLICATE: "Doublon rapide",
  REF_INVALID: "Référence invalide",
  STUDENT_BELONGS_TO_OTHER_ETAB: "Élève d'un autre établissement",
};

export const RISK_LEVEL_LABEL = {
  low: { label: "Faible", color: "bg-emerald-100 text-emerald-700" },
  medium: { label: "Modéré", color: "bg-amber-100 text-amber-700" },
  high: { label: "Élevé", color: "bg-red-100 text-red-700" },
} as const;

export function riskLevel(score: number | null): "low" | "medium" | "high" {
  if (score === null) return "medium";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}