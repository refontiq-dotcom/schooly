import { describe, expect, it } from "vitest";
import {
  computeParentTrustScore,
  detectReservationFraud,
  shouldRejectForFraud,
  compareWaitlistOrder,
  type FraudFlag,
} from "./scoring";

describe("computeParentTrustScore", () => {
  it("retourne 50 (neutre) pour un parent sans historique", () => {
    expect(
      computeParentTrustScore({ total: 0, confirmed: 0, expired: 0, cancelled: 0 })
    ).toBe(50);
  });

  it("augmente le score avec les réservations confirmées (plafonné +30)", () => {
    expect(
      computeParentTrustScore({ total: 1, confirmed: 1, expired: 0, cancelled: 0 })
    ).toBe(60);

    expect(
      computeParentTrustScore({ total: 5, confirmed: 5, expired: 0, cancelled: 0 })
    ).toBe(80);

    // Au-delà de 3 confirmées, le bonus est plafonné
    expect(
      computeParentTrustScore({ total: 100, confirmed: 100, expired: 0, cancelled: 0 })
    ).toBe(80);
  });

  it("pénalise les no-show proportionnellement au taux (plafonné -30)", () => {
    // 0 confirmé, 100% de no-show → pénalité plafonnée à 30, score = 50 - 30 = 20
    const worstScore = computeParentTrustScore({
      total: 10,
      confirmed: 0,
      expired: 10,
      cancelled: 0,
    });
    expect(worstScore).toBe(20);

    // Cas mixte : score 50% de no-show sans bonus de confirmation → pénalité ~20
    const mixedScore = computeParentTrustScore({
      total: 10,
      confirmed: 0,
      expired: 5,
      cancelled: 0,
    });
    // 50 - round(0.5*40) = 50 - 20 = 30
    expect(mixedScore).toBe(30);
  });

  it("plafonne la pénalité no-show à 30 même pour 100% d'expirations", () => {
    const score = computeParentTrustScore({
      total: 100,
      confirmed: 0,
      expired: 100,
      cancelled: 0,
    });
    // base 50 - pénalité 30 (plafond) = 20
    expect(score).toBe(20);
  });

  it("pénalise les annulations (plafonné -20)", () => {
    expect(
      computeParentTrustScore({ total: 5, confirmed: 5, expired: 0, cancelled: 5 })
    ).toBe(80 - 20); // bonus +30 plafonné, pénalité -20

    expect(
      computeParentTrustScore({ total: 100, confirmed: 0, expired: 0, cancelled: 100 })
    ).toBe(30); // base 50 - pénalité 20 = 30
  });

  it("clamp le score entre 0 et 100", () => {
    // Cas extrêmes
    const lowScore = computeParentTrustScore({
      total: 10,
      confirmed: 0,
      expired: 10,
      cancelled: 10,
    });
    expect(lowScore).toBeGreaterThanOrEqual(0);

    const highScore = computeParentTrustScore({
      total: 10,
      confirmed: 10,
      expired: 0,
      cancelled: 0,
    });
    expect(highScore).toBeLessThanOrEqual(100);
  });

  it("scénario réel : parent fiable", () => {
    const score = computeParentTrustScore({
      total: 4,
      confirmed: 4,
      expired: 0,
      cancelled: 0,
    });
    expect(score).toBe(80); // 50 + 30 plafonné
  });

  it("scénario réel : parent à problème", () => {
    const score = computeParentTrustScore({
      total: 6,
      confirmed: 1,
      expired: 3,
      cancelled: 2,
    });
    // base 50 + 10 - round(0.5 * 40) - 10 = 50 - 10 - 10 = 30
    expect(score).toBe(30);
  });
});

describe("detectReservationFraud", () => {
  it("retourne un tableau vide si rien à signaler", () => {
    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 1,
        pendingPaymentsLast24h: 0,
        recentReservationsLastHour: 0,
      })
    ).toEqual([]);
  });

  it("détecte DUPLICATE_STUDENT", () => {
    const flags = detectReservationFraud({
      duplicateStudentCount: 1,
      distinctParentNamesForPhone: 1,
      pendingPaymentsLast24h: 0,
      recentReservationsLastHour: 0,
    });
    expect(flags).toContain("DUPLICATE_STUDENT");
  });

  it("détecte SAME_PHONE_DIFFERENT_NAMES (seuil = >2 noms distincts)", () => {
    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 2,
        pendingPaymentsLast24h: 0,
        recentReservationsLastHour: 0,
      })
    ).not.toContain("SAME_PHONE_DIFFERENT_NAMES");

    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 3,
        pendingPaymentsLast24h: 0,
        recentReservationsLastHour: 0,
      })
    ).toContain("SAME_PHONE_DIFFERENT_NAMES");
  });

  it("détecte MULTIPLE_PENDING_PAYMENT (seuil = >=2)", () => {
    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 1,
        pendingPaymentsLast24h: 1,
        recentReservationsLastHour: 0,
      })
    ).not.toContain("MULTIPLE_PENDING_PAYMENT");

    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 1,
        pendingPaymentsLast24h: 2,
        recentReservationsLastHour: 0,
      })
    ).toContain("MULTIPLE_PENDING_PAYMENT");
  });

  it("détecte RAPID_REPEAT (seuil = >=3 dans l'heure)", () => {
    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 1,
        pendingPaymentsLast24h: 0,
        recentReservationsLastHour: 2,
      })
    ).not.toContain("RAPID_REPEAT");

    expect(
      detectReservationFraud({
        duplicateStudentCount: 0,
        distinctParentNamesForPhone: 1,
        pendingPaymentsLast24h: 0,
        recentReservationsLastHour: 3,
      })
    ).toContain("RAPID_REPEAT");
  });

  it("peut retourner plusieurs flags simultanément", () => {
    const flags = detectReservationFraud({
      duplicateStudentCount: 1,
      distinctParentNamesForPhone: 3,
      pendingPaymentsLast24h: 2,
      recentReservationsLastHour: 4,
    });
    expect(flags).toHaveLength(4);
  });
});

describe("shouldRejectForFraud", () => {
  it("rejette à partir de 2 flags", () => {
    expect(shouldRejectForFraud([])).toBe(false);
    expect(shouldRejectForFraud(["DUPLICATE_STUDENT"])).toBe(false);
    expect(
      shouldRejectForFraud(["DUPLICATE_STUDENT", "RAPID_REPEAT"])
    ).toBe(true);
    expect(
      shouldRejectForFraud([
        "DUPLICATE_STUDENT",
        "RAPID_REPEAT",
        "MULTIPLE_PENDING_PAYMENT",
      ])
    ).toBe(true);
  });
});

describe("compareWaitlistOrder", () => {
  const base = { position: 1, createdAt: new Date("2026-01-01") };

  it("met les scores élevés en premier", () => {
    const a = { ...base, trustScore: 80 };
    const b = { ...base, trustScore: 40 };
    expect(compareWaitlistOrder(a, b)).toBeLessThan(0);
    expect(compareWaitlistOrder(b, a)).toBeGreaterThan(0);
  });

  it("utilise null = 50 comme score neutre", () => {
    const a = { ...base, trustScore: null };
    const b = { ...base, trustScore: 50 };
    expect(compareWaitlistOrder(a, b)).toBe(0);
  });

  it("à score égal, met le plus ancien en premier", () => {
    const older = { ...base, trustScore: 70, createdAt: new Date("2026-01-01") };
    const newer = { ...base, trustScore: 70, createdAt: new Date("2026-02-01") };
    expect(compareWaitlistOrder(older, newer)).toBeLessThan(0);
    expect(compareWaitlistOrder(newer, older)).toBeGreaterThan(0);
  });

  it("trie correctement un mélange réel", () => {
    const queue = [
      { position: 1, trustScore: 50 as number | null, createdAt: new Date("2026-01-01") },
      { position: 2, trustScore: 90 as number | null, createdAt: new Date("2026-01-02") },
      { position: 3, trustScore: 30 as number | null, createdAt: new Date("2026-01-03") },
      { position: 4, trustScore: 70 as number | null, createdAt: new Date("2026-01-04") },
    ];
    const sorted = [...queue].sort(compareWaitlistOrder);
    // Ordre attendu : 90 → 70 → 50 → 30
    expect(sorted.map((s) => s.trustScore)).toEqual([90, 70, 50, 30]);
  });
});

describe("Intégration anti-survente — invariants métier", () => {
  it("un parent fiable a un score supérieur à un parent problématique", () => {
    const reliable = computeParentTrustScore({
      total: 5,
      confirmed: 5,
      expired: 0,
      cancelled: 0,
    });
    const unreliable = computeParentTrustScore({
      total: 5,
      confirmed: 0,
      expired: 5,
      cancelled: 0,
    });
    expect(reliable).toBeGreaterThan(unreliable);
  });

  it("les flags de fraude sont mutuellement informatifs", () => {
    // Un téléphone partagé + paiements multiples = fraude évidente
    const flags: FraudFlag[] = detectReservationFraud({
      duplicateStudentCount: 0,
      distinctParentNamesForPhone: 4,
      pendingPaymentsLast24h: 3,
      recentReservationsLastHour: 0,
    });
    expect(shouldRejectForFraud(flags)).toBe(true);
  });
});