import type { BalanceInfo, CaisseEnrollment, CaissePayment, CashSession } from "./types"

/** Inscription caisse de référence (élève de 6e A, tuteur renseigné). */
export function makeCaisseEnrollment(
  overrides: Partial<CaisseEnrollment> = {},
): CaisseEnrollment {
  return {
    id: "enr-1",
    matricule: "MAT-001",
    students: { first_name: "Awa", last_name: "Koné" },
    guardians: { full_name: "Bintou Koné", phone: "0700000001" },
    grade_levels: { name: "6e A" },
    ...overrides,
  }
}

/** Paiement caisse de référence (reçu d'hier, espèces). */
export function makeCaissePayment(overrides: Partial<CaissePayment> = {}): CaissePayment {
  return {
    id: "pay-1",
    amount: 15000,
    payment_method: "cash",
    reference: null,
    received_at: "2026-09-19T10:30:00.000Z",
    enrollments: {
      matricule: "MAT-001",
      students: { first_name: "Awa", last_name: "Koné" },
      guardians: { full_name: "Bintou Koné" },
    },
    ...overrides,
  }
}

/** Solde caisse de référence (élève avec échéancier, reste à payer). */
export function makeBalanceInfo(overrides: Partial<BalanceInfo> = {}): BalanceInfo {
  return {
    balance: 25000,
    hasFeeItems: true,
    nextDueAmount: 25000,
    nextDueDate: "2026-10-05",
    ...overrides,
  }
}

/** Session de caisse ouverte de référence. */
export function makeCashSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: "sess-1",
    opening_amount: 50000,
    status: "open",
    opened_at: "2026-09-20T08:00:00.000Z",
    ...overrides,
  }
}
