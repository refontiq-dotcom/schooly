import { describe, expect, it } from "vitest";
import {
  computeRiskLevel,
  normalizeScore,
  averageScore,
  medianScore,
  stdDeviation,
  distributeGrades,
  predictAverage,
  gradeBucket,
} from "./scoring";

describe("normalizeScore", () => {
  it("convertit une note /20 vers /20 (no-op)", () => {
    expect(normalizeScore(15, 20)).toBe(15);
  });

  it("convertit une note /10 vers /20", () => {
    expect(normalizeScore(8, 10)).toBe(16);
  });

  it("convertit une note /40 vers /20", () => {
    expect(normalizeScore(30, 40)).toBe(15);
  });

  it("clamp 0..20", () => {
    expect(normalizeScore(-5, 20)).toBe(0);
    expect(normalizeScore(50, 20)).toBe(20);
  });

  it("retourne 0 si max_score est invalide", () => {
    expect(normalizeScore(10, 0)).toBe(0);
    expect(normalizeScore(10, -5)).toBe(0);
  });
});

describe("averageScore", () => {
  it("retourne 0 pour un tableau vide", () => {
    expect(averageScore([])).toBe(0);
  });

  it("calcule la moyenne", () => {
    expect(averageScore([10, 12, 14])).toBe(12);
  });
});

describe("medianScore", () => {
  it("retourne 0 pour un tableau vide", () => {
    expect(medianScore([])).toBe(0);
  });

  it("calcule la médiane impaire", () => {
    expect(medianScore([10, 12, 14])).toBe(12);
  });

  it("calcule la médiane paire (moyenne des 2 du milieu)", () => {
    expect(medianScore([10, 12, 14, 16])).toBe(13);
  });

  it("ne trie pas le tableau d'entrée", () => {
    const input = [14, 10, 16, 12];
    expect(medianScore(input)).toBe(13);
    expect(input).toEqual([14, 10, 16, 12]);
  });
});

describe("stdDeviation", () => {
  it("retourne 0 pour 0 ou 1 valeur", () => {
    expect(stdDeviation([])).toBe(0);
    expect(stdDeviation([10])).toBe(0);
  });

  it("calcule l'écart-type", () => {
    // valeurs [10, 10, 10] → std=0
    expect(stdDeviation([10, 10, 10])).toBe(0);

    // valeurs [10, 20] → variance = ((10-15)² + (20-15)²) / 2 = 25 → std=5
    expect(stdDeviation([10, 20])).toBe(5);
  });
});

describe("distributeGrades", () => {
  it("distribue correctement", () => {
    const r = distributeGrades({ scores: [17, 18, 15, 12, 8, 5] });
    expect(r.excellent).toBe(2); // 17, 18
    expect(r.bien).toBe(1);      // 15
    expect(r.moyen).toBe(1);     // 12
    expect(r.fragile).toBe(1);   // 8
    expect(r.critique).toBe(1);  // 5
  });

  it("gère un tableau vide", () => {
    expect(distributeGrades({ scores: [] })).toEqual({
      excellent: 0,
      bien: 0,
      moyen: 0,
      fragile: 0,
      critique: 0,
    });
  });
});

describe("predictAverage", () => {
  it("retourne 0 sans données", () => {
    expect(predictAverage({ scoresOrdered: [] })).toBe(0);
  });

  it("retourne la moyenne si < 2 notes", () => {
    expect(predictAverage({ scoresOrdered: [14] })).toBe(14);
  });

  it("projette une tendance positive", () => {
    // Croissance +2 par note, moyenne ≈ 12
    const r = predictAverage({ scoresOrdered: [8, 10, 12, 14] });
    // moyenne = 11, trend = 2, horizon 3 → 11 + 2*3 = 17
    expect(r).toBe(17);
  });

  it("projette une tendance négative (déclenche un signal de décrochage)", () => {
    // Décroissance -2 par note
    const r = predictAverage({ scoresOrdered: [14, 12, 10, 8] });
    // moyenne = 11, trend = -2, horizon 3 → 11 - 6 = 5
    expect(r).toBe(5);
  });

  it("clamp 0..20", () => {
    expect(
      predictAverage({ scoresOrdered: [20, 20, 20, 20], horizon: 10 })
    ).toBe(20);
  });
});

describe("gradeBucket", () => {
  it("excellent ≥ 16", () => {
    expect(gradeBucket(16)).toBe("excellent");
    expect(gradeBucket(20)).toBe("excellent");
  });
  it("bien 14..15.99", () => {
    expect(gradeBucket(14)).toBe("bien");
    expect(gradeBucket(15.99)).toBe("bien");
  });
  it("moyen 10..13.99", () => {
    expect(gradeBucket(10)).toBe("moyen");
    expect(gradeBucket(13.99)).toBe("moyen");
  });
  it("fragile 8..9.99", () => {
    expect(gradeBucket(8)).toBe("fragile");
    expect(gradeBucket(9.99)).toBe("fragile");
  });
  it("critique < 8", () => {
    expect(gradeBucket(7.99)).toBe("critique");
    expect(gradeBucket(0)).toBe("critique");
  });
});

describe("computeRiskLevel", () => {
  it("low : aucun signal", () => {
    expect(
      computeRiskLevel({
        latestScore: 14,
        previousScore: 13,
        recentAbsences: 0,
        behaviorCount: 0,
        currentAverage: 13,
      })
    ).toBe("low");
  });

  it("medium : 1 signal", () => {
    expect(
      computeRiskLevel({
        latestScore: 10,
        previousScore: 16, // drop 37.5%
        recentAbsences: 0,
        behaviorCount: 0,
        currentAverage: 12,
      })
    ).toBe("medium");
  });

  it("high : 2+ signaux", () => {
    expect(
      computeRiskLevel({
        latestScore: 6,
        previousScore: 14, // drop 57%
        recentAbsences: 4, // 3+
        behaviorCount: 1,
        currentAverage: 7, // < 8
      })
    ).toBe("high");
  });

  it("détecte les absences répétées seules", () => {
    expect(
      computeRiskLevel({
        latestScore: null,
        previousScore: null,
        recentAbsences: 3,
        behaviorCount: 0,
        currentAverage: null,
      })
    ).toBe("medium");
  });

  it("détecte les notes de comportement seules", () => {
    expect(
      computeRiskLevel({
        latestScore: null,
        previousScore: null,
        recentAbsences: 0,
        behaviorCount: 2,
        currentAverage: 14,
      })
    ).toBe("medium");
  });

  it("détecte une moyenne faible seule", () => {
    expect(
      computeRiskLevel({
        latestScore: null,
        previousScore: null,
        recentAbsences: 0,
        behaviorCount: 0,
        currentAverage: 6,
      })
    ).toBe("medium");
  });
});