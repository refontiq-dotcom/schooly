import { describe, expect, it } from "vitest";
import {
  buildParentAlerts,
  computeParentSatisfaction,
  generateWhatsAppSummary,
  isChildHealthy,
  type ChildSummary,
} from "./scoring";

const baseSummary: ChildSummary = {
  studentId: "s1",
  fullName: "Aya Kouassi",
  levelName: "6ème",
  sectionName: "6ème1",
  currentAverage: 14,
  gradesCount: 10,
  attendancePct: 95,
  recentAbsences: 0,
  feesRemaining: 0,
  feesOverdueCount: 0,
  docsMissingCount: 0,
  behaviorConcernsCount: 0,
  hasRecentDrop: false,
  parentSatisfactionScore: 90,
};

describe("buildParentAlerts", () => {
  it("aucune alerte pour un enfant sain", () => {
    expect(buildParentAlerts(baseSummary)).toEqual([]);
  });

  it("détecte grade_drop", () => {
    const alerts = buildParentAlerts({ ...baseSummary, hasRecentDrop: true });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("grade_drop");
    expect(alerts[0].severity).toBe("high");
  });

  it("détecte absences répétées (>= 3)", () => {
    expect(buildParentAlerts({ ...baseSummary, recentAbsences: 3 })).toHaveLength(1);
    expect(buildParentAlerts({ ...baseSummary, recentAbsences: 2 })).toHaveLength(0);
  });

  it("détecte faible assiduité (< 75%)", () => {
    expect(buildParentAlerts({ ...baseSummary, attendancePct: 74 })).toHaveLength(1);
    expect(buildParentAlerts({ ...baseSummary, attendancePct: 75 })).toHaveLength(0);
    expect(buildParentAlerts({ ...baseSummary, attendancePct: null })).toHaveLength(0);
  });

  it("détecte frais en retard", () => {
    const alerts = buildParentAlerts({ ...baseSummary, feesOverdueCount: 2, feesRemaining: 50000 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain("50000");
  });

  it("détecte documents manquants", () => {
    const alerts = buildParentAlerts({ ...baseSummary, docsMissingCount: 3 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("docs_missing");
  });

  it("détecte suivi comportement (>= 2)", () => {
    expect(buildParentAlerts({ ...baseSummary, behaviorConcernsCount: 2 })).toHaveLength(1);
    expect(buildParentAlerts({ ...baseSummary, behaviorConcernsCount: 1 })).toHaveLength(0);
  });

  it("détecte excellence (>= 16)", () => {
    const alerts = buildParentAlerts({ ...baseSummary, currentAverage: 17 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("excellence");
    expect(alerts[0].severity).toBe("positive");
  });

  it("peut retourner plusieurs alertes simultanées", () => {
    const alerts = buildParentAlerts({
      ...baseSummary,
      hasRecentDrop: true,
      recentAbsences: 5,
      feesOverdueCount: 1,
    });
    expect(alerts).toHaveLength(3);
  });
});

describe("computeParentSatisfaction", () => {
  it("retourne un score élevé pour un enfant parfait", () => {
    const score = computeParentSatisfaction({
      attendancePct: 100,
      currentAverage: 18,
      feesOverdueCount: 0,
      docsMissingCount: 0,
      behaviorConcernsCount: 0,
    });
    // Score max = 50 (vue SQL divise par 2)
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it("pénalise les frais en retard", () => {
    // On utilise des valeurs qui ne s'écrasent pas au plafond 50
    const good = computeParentSatisfaction({
      attendancePct: 50,
      currentAverage: 10,
      feesOverdueCount: 0,
      docsMissingCount: 1,
      behaviorConcernsCount: 0,
    });
    const bad = computeParentSatisfaction({
      attendancePct: 50,
      currentAverage: 10,
      feesOverdueCount: 1,
      docsMissingCount: 1,
      behaviorConcernsCount: 0,
    });
    expect(good).toBeGreaterThan(bad);
    // good = (50 + 20 + 0 + 0) / 2 = 35 ; bad = (50 + 20 - 20 + 0) / 2 = 25
    expect(good - bad).toBe(10);
  });

  it("pénalise les comportements", () => {
    const withoutBehavior = computeParentSatisfaction({
      attendancePct: 50,
      currentAverage: 10,
      feesOverdueCount: 1,
      docsMissingCount: 1,
      behaviorConcernsCount: 0,
    });
    const withBehavior = computeParentSatisfaction({
      attendancePct: 50,
      currentAverage: 10,
      feesOverdueCount: 1,
      docsMissingCount: 1,
      behaviorConcernsCount: 4,
    });
    // 4 comportements = -20 raw = -10 après division par 2
    expect(withoutBehavior - withBehavior).toBe(10);
  });

  it("clamp 0..50", () => {
    expect(
      computeParentSatisfaction({
        attendancePct: 0,
        currentAverage: 0,
        feesOverdueCount: 99,
        docsMissingCount: 99,
        behaviorConcernsCount: 99,
      })
    ).toBe(0);

    expect(
      computeParentSatisfaction({
        attendancePct: 100,
        currentAverage: 20,
        feesOverdueCount: 0,
        docsMissingCount: 0,
        behaviorConcernsCount: 0,
      })
    ).toBe(50);
  });
});

describe("generateWhatsAppSummary", () => {
  it("inclut nom et classe", () => {
    const s = generateWhatsAppSummary({
      fullName: "Aya",
      levelName: "6ème",
      sectionName: "6ème1",
      currentAverage: 0,
      attendancePct: null,
      rankInSection: null,
      sectionSize: 0,
      feesRemaining: 0,
      feesOverdueCount: 0,
      docsMissingCount: 0,
    });
    expect(s).toContain("Aya");
    expect(s).toContain("6ème");
  });

  it("omet les champs absents", () => {
    const s = generateWhatsAppSummary({
      fullName: "Aya",
      levelName: null,
      sectionName: null,
      currentAverage: 0,
      attendancePct: null,
      rankInSection: null,
      sectionSize: 0,
      feesRemaining: 0,
      feesOverdueCount: 0,
      docsMissingCount: 0,
    });
    expect(s).toBe("📚 *Aya* —  / ");
  });

  it("ajoute le suffixe 'en retard' pour les frais en retard", () => {
    const s = generateWhatsAppSummary({
      fullName: "Aya",
      levelName: "6ème",
      sectionName: "6ème1",
      currentAverage: 14,
      attendancePct: 90,
      rankInSection: 2,
      sectionSize: 30,
      feesRemaining: 50000,
      feesOverdueCount: 2,
      docsMissingCount: 0,
    });
    expect(s).toContain("50000");
    expect(s).toContain("2 en retard");
  });
});

describe("isChildHealthy", () => {
  it("true : aucune alerte (hors excellence)", () => {
    expect(isChildHealthy(baseSummary)).toBe(true);
  });

  it("false : au moins une alerte négative", () => {
    expect(isChildHealthy({ ...baseSummary, recentAbsences: 3 })).toBe(false);
  });

  it("true même avec alerte positive (excellence)", () => {
    expect(isChildHealthy({ ...baseSummary, currentAverage: 18 })).toBe(true);
  });
});