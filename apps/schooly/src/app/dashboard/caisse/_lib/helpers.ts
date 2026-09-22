import type { BalanceInfo, CaisseEnrollment, CaissePayment } from "./types"

/** Recherche insensible à la casse sur matricule + nom + prénom. */
export function matchesSearch(enrollment: CaisseEnrollment, needle: string): boolean {
  const query = needle.trim().toLowerCase()
  if (!query) return true
  const haystack = [
    enrollment.matricule ?? "",
    enrollment.students.last_name,
    enrollment.students.first_name,
    enrollment.guardians.phone,
    enrollment.grade_levels.name,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

/** Filtre la liste des inscriptions selon la recherche. */
export function filterEnrollments(
  enrollments: CaisseEnrollment[],
  needle: string,
): CaisseEnrollment[] {
  return enrollments.filter((e) => matchesSearch(e, needle))
}

/** Bornes ISO jour (YYYY-MM-DD) d'un timestamp ISO. */
export function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

/** Paiements encaissés sur le jour donné (bornes ISO YYYY-MM-DD). */
export function paymentsForDay(payments: CaissePayment[], dayIso: string): CaissePayment[] {
  const day = isoDay(dayIso)
  return payments.filter((p) => isoDay(p.received_at) === day)
}

/** Somme des montants d'une liste de paiements. */
export function totalOf(payments: CaissePayment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0)
}

/**
 * Montant pré-rempli du formulaire d'encaissement :
 * prochaine échéance si elle existe, sinon solde courant, sinon vide
 * (élève sans reste à payer — montant libre saisi par le caissier).
 */
export function defaultAmountFor(balance: number, info?: BalanceInfo | null): string {
  if (info?.nextDueAmount != null && info.nextDueAmount > 0) return String(info.nextDueAmount)
  if (balance > 0) return String(balance)
  return ""
}
