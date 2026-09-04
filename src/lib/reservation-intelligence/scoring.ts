/**
 * Logique de scoring de confiance parent — implémentation TypeScript miroir
 * de la fonction Postgres `compute_parent_trust_score()`.
 *
 * Cette implémentation existe pour :
 *   1. Pouvoir afficher un score estimé côté client (UX immédiate) ;
 *   2. Pouvoir tester les invariants sans dépendre d'une base Postgres ;
 *   3. Documenter précisément la règle métier.
 *
 * La valeur de référence reste la fonction Postgres (utilisée à la création
 * d'une réservation et lors du scoring du tunnel de conversion). Ce miroir
 * TypeScript doit rester synchronisé avec elle.
 */

export interface ParentStats {
  total: number;
  confirmed: number;
  expired: number;
  cancelled: number;
}

const BASE_SCORE = 50;
const CONFIRMED_BONUS_PER = 10;
const CONFIRMED_BONUS_MAX = 30;
const NO_SHOW_PENALTY_FACTOR = 40;
const NO_SHOW_PENALTY_MAX = 30;
const CANCELLED_PENALTY_PER = 5;
const CANCELLED_PENALTY_MAX = 20;

export function computeParentTrustScore(stats: ParentStats): number {
  const { total, confirmed, expired, cancelled } = stats;

  if (total === 0) {
    return BASE_SCORE;
  }

  const noShowRate = expired / total;

  let score = BASE_SCORE;
  score += Math.min(confirmed * CONFIRMED_BONUS_PER, CONFIRMED_BONUS_MAX);
  score -= Math.min(Math.round(noShowRate * NO_SHOW_PENALTY_FACTOR), NO_SHOW_PENALTY_MAX);
  score -= Math.min(cancelled * CANCELLED_PENALTY_PER, CANCELLED_PENALTY_MAX);

  return Math.max(0, Math.min(100, score));
}

export interface FraudInput {
  /** Nombre d'élèves existants (même nom + birthdate) dans l'établissement */
  duplicateStudentCount: number;
  /** Nombre de noms de parents distincts pour ce téléphone sur 6 mois */
  distinctParentNamesForPhone: number;
  /** Nombre de réservations en pending_payment sur 24h pour ce contact */
  pendingPaymentsLast24h: number;
  /** Nombre de réservations créées dans la dernière heure pour ce téléphone */
  recentReservationsLastHour: number;
}

export type FraudFlag =
  | "DUPLICATE_STUDENT"
  | "SAME_PHONE_DIFFERENT_NAMES"
  | "MULTIPLE_PENDING_PAYMENT"
  | "RAPID_REPEAT";

const FRAUD_THRESHOLD_COUNT = 2;

export function detectReservationFraud(input: FraudInput): FraudFlag[] {
  const flags: FraudFlag[] = [];

  if (input.duplicateStudentCount > 0) {
    flags.push("DUPLICATE_STUDENT");
  }
  if (input.distinctParentNamesForPhone > 2) {
    flags.push("SAME_PHONE_DIFFERENT_NAMES");
  }
  if (input.pendingPaymentsLast24h >= 2) {
    flags.push("MULTIPLE_PENDING_PAYMENT");
  }
  if (input.recentReservationsLastHour >= 3) {
    flags.push("RAPID_REPEAT");
  }

  return flags;
}

/** Détermine si la réservation doit être rejetée pour fraude. */
export function shouldRejectForFraud(flags: FraudFlag[]): boolean {
  return flags.length >= FRAUD_THRESHOLD_COUNT;
}

export interface WaitlistOrderInput {
  trustScore: number | null;
  position: number;
  createdAt: Date;
}

/**
 * Renvoie un comparateur utilisable avec `Array.sort` qui :
 *   1. Met les parents avec le meilleur score de confiance en premier ;
 *   2. À score égal, met les plus anciennes inscriptions en premier.
 *
 * Cela garantit que `Array.sort(cmp)` ordonne la file pour la promotion.
 */
export function compareWaitlistOrder(a: WaitlistOrderInput, b: WaitlistOrderInput): number {
  const aScore = a.trustScore ?? 50;
  const bScore = b.trustScore ?? 50;

  if (aScore !== bScore) {
    return bScore - aScore; // desc
  }

  return a.createdAt.getTime() - b.createdAt.getTime(); // asc
}

export const FRAUD_FLAG_LABEL: Record<FraudFlag, string> = {
  DUPLICATE_STUDENT: "Élève déjà inscrit",
  SAME_PHONE_DIFFERENT_NAMES: "Téléphone utilisé par plusieurs parents",
  MULTIPLE_PENDING_PAYMENT: "Paiements multiples en attente",
  RAPID_REPEAT: "Réservations répétées anormalement rapides",
};