import { computeSubjectAverage, type Grade, type Rules } from "./calculations"

export type ExpectedAssessment = { id: string; max_value: number; weight: number; grade_type: string }
export type EnteredGrade = {
  assessment_id: string | null; value: number | null; max_value: number; weight: number
  grade_type: string; absence_status: "graded" | "excused"
}
const category = (value: string): Grade["category"] => value === "interrogation" || value === "composition" ? value : "devoir"

/** Les notes non rattachées restent visibles mais ne prouvent jamais la complétude. */
export function computeExpectedSubject(assessments: ExpectedAssessment[], grades: EnteredGrade[], rules: Rules) {
  const entries = new Map<string, EnteredGrade>()
  for (const grade of grades) {
    if (grade.assessment_id) {
      if (entries.has(grade.assessment_id)) throw new Error("Plusieurs notes pour la même évaluation.")
      entries.set(grade.assessment_id, grade)
    }
  }
  const planned: Grade[] = assessments.map(a => {
    const grade = entries.get(a.id)
    return { value: grade?.value ?? null, maxValue: Number(a.max_value), weight: Number(a.weight),
      category: category(a.grade_type), status: grade?.absence_status ?? "missing" }
  })
  const unlinked = grades.filter(g => !g.assessment_id || !assessments.some(a => a.id === g.assessment_id))
  const average = computeSubjectAverage([...planned, ...unlinked.map(g => ({
    value: g.value === null ? null : Number(g.value), maxValue: Number(g.max_value), weight: Number(g.weight),
    category: category(g.grade_type), status: g.absence_status,
  }))], rules)
  const entered = assessments.filter(a => entries.has(a.id)).length
  return {
    average: { ...average, complete: average.complete && assessments.length > 0 && entered === assessments.length && unlinked.length === 0 },
    expected: assessments.length, entered, unlinked: unlinked.length,
  }
}
