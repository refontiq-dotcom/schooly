import { describe, it, expect } from "vitest";
import {
  groupGradesBySubject,
  groupGradesByEvaluationType,
  attendanceRateFromRecords,
  behaviorBalance,
} from "@/lib/student-intelligence/scoring";

describe("student-intelligence/scoring", () => {
  describe("groupGradesBySubject", () => {
    it("agrège et convertit en /20", () => {
      const result = groupGradesBySubject([
        { subject: "Mathématiques", score: 14, max_score: 20 },
        { subject: "Mathématiques", score: 16, max_score: 20 },
        { subject: "Français", score: 8, max_score: 10 },
      ]);
      expect(result).toHaveLength(2);
      const math = result.find((r) => r.subject === "Mathématiques");
      expect(math?.count).toBe(2);
      expect(math?.average).toBe(15);
      expect(math?.bucket).toBe("bien");
      const fr = result.find((r) => r.subject === "Français");
      expect(fr?.average).toBe(16);
    });

    it("liste vide", () => {
      expect(groupGradesBySubject([])).toEqual([]);
    });
  });

  describe("groupGradesByEvaluationType", () => {
    it("sépare devoir et composition", () => {
      const result = groupGradesByEvaluationType([
        { evaluation_type: "devoir", score: 10, max_score: 20 },
        { evaluation_type: "composition", score: 12, max_score: 20 },
        { evaluation_type: "devoir", score: 14, max_score: 20 },
      ]);
      const devoir = result.find((r) => r.evaluationType === "devoir");
      expect(devoir?.count).toBe(2);
      expect(devoir?.average).toBe(12);
    });
  });

  describe("attendanceRateFromRecords", () => {
    it("calcule le pourcentage", () => {
      expect(
        attendanceRateFromRecords([{ present: true }, { present: true }, { present: false }])
      ).toBe(67);
    });
    it("null si aucune séance", () => {
      expect(attendanceRateFromRecords([])).toBeNull();
    });
  });

  describe("behaviorBalance", () => {
    it("compte par type", () => {
      expect(
        behaviorBalance([
          { kind: "positif" },
          { kind: "incident" },
          { kind: "incident" },
          { kind: "a_surveiller" },
        ])
      ).toEqual({ positif: 1, a_surveiller: 1, incident: 2, total: 4 });
    });
  });
});
