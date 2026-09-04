import { averageScore, gradeBucket, normalizeScore, type GradeBucket } from "@/lib/teacher-intelligence/scoring";

export type SubjectAverage = {
  subject: string;
  count: number;
  average: number;
  min: number;
  max: number;
  bucket: GradeBucket;
};

export type EvaluationTypeAverage = {
  evaluationType: string;
  count: number;
  average: number;
};

export type BehaviorBalance = {
  positif: number;
  a_surveiller: number;
  incident: number;
  total: number;
};

export function groupGradesBySubject(
  grades: Array<{ subject: string; score: number; max_score: number }>
): SubjectAverage[] {
  const map = new Map<string, number[]>();
  for (const g of grades) {
    const n = normalizeScore(g.score, g.max_score);
    const list = map.get(g.subject) ?? [];
    list.push(n);
    map.set(g.subject, list);
  }
  return [...map.entries()]
    .map(([subject, scores]) => {
      const average = round1(averageScore(scores));
      return {
        subject,
        count: scores.length,
        average,
        min: round1(Math.min(...scores)),
        max: round1(Math.max(...scores)),
        bucket: gradeBucket(average),
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, "fr"));
}

export function groupGradesByEvaluationType(
  grades: Array<{ evaluation_type: string; score: number; max_score: number }>
): EvaluationTypeAverage[] {
  const map = new Map<string, number[]>();
  for (const g of grades) {
    const key = g.evaluation_type || "autre";
    const list = map.get(key) ?? [];
    list.push(normalizeScore(g.score, g.max_score));
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([evaluationType, scores]) => ({
      evaluationType,
      count: scores.length,
      average: round1(averageScore(scores)),
    }))
    .sort((a, b) => a.evaluationType.localeCompare(b.evaluationType, "fr"));
}

export function attendanceRateFromRecords(
  records: Array<{ present: boolean }>
): number | null {
  if (records.length === 0) return null;
  const present = records.filter((r) => r.present).length;
  return Math.round((present / records.length) * 100);
}

export function behaviorBalance(
  notes: Array<{ kind: string }>
): BehaviorBalance {
  const result: BehaviorBalance = {
    positif: 0,
    a_surveiller: 0,
    incident: 0,
    total: notes.length,
  };
  for (const n of notes) {
    if (n.kind === "positif") result.positif += 1;
    else if (n.kind === "a_surveiller") result.a_surveiller += 1;
    else if (n.kind === "incident") result.incident += 1;
  }
  return result;
}

export const EVALUATION_TYPE_LABEL: Record<string, string> = {
  interrogation: "Interrogation",
  devoir: "Devoir",
  composition: "Composition",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
