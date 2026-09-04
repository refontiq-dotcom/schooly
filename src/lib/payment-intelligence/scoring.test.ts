import { describe, expect, it } from "vitest";
import {
  computePaymentRiskScore,
  detectPaymentAnomaly,
  daysLate,
  remainingAmount,
  riskLevel,
  type PaymentAnomalyFlag,
} from "./scoring";

describe("computePaymentRiskScore", () => {
  it("retourne 30 (neutre) pour un payeur sans historique", () => {
    expect(
      computePaymentRiskScore({ total: 0, confirmed: 0, failed: 0, overdue: 0, lateDaysAvg: 0 })
    ).toBe(30);
  });

  it("retourne 0 pour un payeur parfait", () => {
    expect(
      computePaymentRiskScore({ total: 5, confirmed: 5, failed: 0, overdue: 0, lateDaysAvg: 0 })
    ).toBe(0);
  });

  it("augmente avec les échecs proportionnellement au total", () => {
    // 50% d'échecs (1/2)
    const score = computePaymentRiskScore({
      total: 2,
      confirmed: 1,
      failed: 1,
      overdue: 0,
      lateDaysAvg: 0,
    });
    expect(score).toBe(25);
  });

  it("pénalise les retards (plafonné +20)", () => {
    expect(
      computePaymentRiskScore({ total: 5, confirmed: 5, failed: 0, overdue: 0, lateDaysAvg: 10 })
    ).toBe(10);

    expect(
      computePaymentRiskScore({ total: 5, confirmed: 5, failed: 0, overdue: 0, lateDaysAvg: 50 })
    ).toBe(20);
  });

  it("ajoute +15 si aucun paiement confirmé", () => {
    const score = computePaymentRiskScore({
      total: 2,
      confirmed: 0,
      failed: 2,
      overdue: 0,
      lateDaysAvg: 0,
    });
    // base 50 * 2/2 = 50, + 15 = 65
    expect(score).toBe(65);
  });

  it("clamp 0..100", () => {
    expect(
      computePaymentRiskScore({ total: 10, confirmed: 0, failed: 10, overdue: 10, lateDaysAvg: 365 })
    ).toBe(100);

    expect(
      computePaymentRiskScore({ total: 100, confirmed: 100, failed: 0, overdue: 0, lateDaysAvg: 0 })
    ).toBe(0);
  });

  it("scénario réel : parent fiable", () => {
    const score = computePaymentRiskScore({
      total: 10,
      confirmed: 10,
      failed: 0,
      overdue: 0,
      lateDaysAvg: 0,
    });
    expect(score).toBe(0);
  });

  it("scénario réel : parent à problème", () => {
    // 4 paiements : 1 confirmé, 1 failed, 1 overdue, 1 pending = 4
    // taux échec = 2/4 = 50% → base 25
    // retard moyen 8j → +8
    // aucun confirmed (=0) : pas applicable (1 > 0)
    const score = computePaymentRiskScore({
      total: 4,
      confirmed: 1,
      failed: 1,
      overdue: 1,
      lateDaysAvg: 8,
    });
    expect(score).toBe(33);
  });
});

describe("detectPaymentAnomaly", () => {
  const baseInput = {
    amount: 10000,
    reference: "OM-123456",
    studentId: "student-1",
    paymentId: "pay-1",
    paidAt: new Date(),
    recentSameRefPayments: [],
    averageConfirmedAmount: 50000,
    studentFeeEtabMatches: true,
  };

  it("retourne un tableau vide quand tout est normal", () => {
    expect(detectPaymentAnomaly(baseInput)).toEqual([]);
  });

  it("détecte AMOUNT_INVALID (montant négatif ou nul)", () => {
    expect(detectPaymentAnomaly({ ...baseInput, amount: 0 })).toContain("AMOUNT_INVALID");
    expect(detectPaymentAnomaly({ ...baseInput, amount: -100 })).toContain("AMOUNT_INVALID");
  });

  it("détecte AMOUNT_OUTLIER (5× la moyenne)", () => {
    expect(
      detectPaymentAnomaly({ ...baseInput, amount: 50000 * 6, averageConfirmedAmount: 50000 })
    ).toContain("AMOUNT_OUTLIER");

    expect(
      detectPaymentAnomaly({ ...baseInput, amount: 50000 * 5, averageConfirmedAmount: 50000 })
    ).not.toContain("AMOUNT_OUTLIER");
  });

  it("détecte REF_INVALID (trop court)", () => {
    expect(detectPaymentAnomaly({ ...baseInput, reference: "AB" })).toContain("REF_INVALID");
    expect(detectPaymentAnomaly({ ...baseInput, reference: "A".repeat(100) })).toContain("REF_INVALID");
    expect(detectPaymentAnomaly({ ...baseInput, reference: null })).not.toContain("REF_INVALID");
  });

  it("détecte RAPID_DUPLICATE (même réf + montant dans les 5 dernières minutes)", () => {
    const input = {
      ...baseInput,
      recentSameRefPayments: [
        {
          id: "pay-2",
          amount: 10000,
          reference: "OM-123456",
          createdAt: new Date(Date.now() - 2 * 60 * 1000),
        },
      ],
    };
    expect(detectPaymentAnomaly(input)).toContain("RAPID_DUPLICATE");
  });

  it("ne signale pas RAPID_DUPLICATE si le doublon est ancien (>5min)", () => {
    const input = {
      ...baseInput,
      recentSameRefPayments: [
        {
          id: "pay-2",
          amount: 10000,
          reference: "OM-123456",
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      ],
    };
    expect(detectPaymentAnomaly(input)).not.toContain("RAPID_DUPLICATE");
  });

  it("détecte STUDENT_BELONGS_TO_OTHER_ETAB", () => {
    expect(
      detectPaymentAnomaly({ ...baseInput, studentFeeEtabMatches: false })
    ).toContain("STUDENT_BELONGS_TO_OTHER_ETAB");
  });

  it("peut détecter plusieurs flags simultanément", () => {
    const flags: PaymentAnomalyFlag[] = detectPaymentAnomaly({
      ...baseInput,
      amount: -1,
      reference: "X",
      studentFeeEtabMatches: false,
    });
    expect(flags.length).toBeGreaterThanOrEqual(3);
  });
});

describe("daysLate", () => {
  it("retourne 0 pour une date future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(daysLate(future)).toBe(0);
  });

  it("retourne 0 pour aujourd'hui", () => {
    expect(daysLate(new Date())).toBe(0);
  });

  it("compte les jours dans le passé", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(daysLate(past)).toBeGreaterThanOrEqual(9);
    expect(daysLate(past)).toBeLessThanOrEqual(11);
  });

  it("retourne 0 pour null", () => {
    expect(daysLate(null)).toBe(0);
  });
});

describe("remainingAmount", () => {
  it("retourne le delta restant", () => {
    expect(remainingAmount({ amount: 100000, amountPaid: 60000 })).toBe(40000);
  });

  it("retourne 0 si tout est payé", () => {
    expect(remainingAmount({ amount: 100000, amountPaid: 100000 })).toBe(0);
  });

  it("retourne 0 si trop-perçu (jamais négatif)", () => {
    expect(remainingAmount({ amount: 100000, amountPaid: 120000 })).toBe(0);
  });
});

describe("riskLevel", () => {
  it("low : score < 30", () => {
    expect(riskLevel(0)).toBe("low");
    expect(riskLevel(29)).toBe("low");
  });
  it("medium : 30..59", () => {
    expect(riskLevel(30)).toBe("medium");
    expect(riskLevel(59)).toBe("medium");
  });
  it("high : ≥ 60", () => {
    expect(riskLevel(60)).toBe("high");
    expect(riskLevel(100)).toBe("high");
  });
  it("null → medium", () => {
    expect(riskLevel(null)).toBe("medium");
  });
});