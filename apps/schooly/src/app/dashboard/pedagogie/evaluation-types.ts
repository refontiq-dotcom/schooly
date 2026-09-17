import type { EvaluationMode, Rules } from "@/lib/evaluation/calculations"

export type EvaluationRule = {
  id: string; academic_year_id: string; cycle: string; mode: EvaluationMode
  scale: number; threshold: number; rescue_margin: number
  interrogation_percent: number | null; devoir_percent: number | null; composition_percent: number | null
}
export type EvaluationPeriod = {
  id: string; rule_id: string; label: string; position: number; is_passage: boolean
  starts_at: string; ends_at: string; locked_at: string | null
}
export type EvaluationAssessment = {
  id: string; period_id: string; class_id: string; subject_id: string
  grade_type: "interrogation" | "devoir" | "composition"; label: string; max_value: number; weight: number
}

export function toRules(rule: Omit<EvaluationRule, "id">): Rules {
  return {
    mode: rule.mode, scale: Number(rule.scale), threshold: Number(rule.threshold), rescueMargin: Number(rule.rescue_margin),
    categoryWeights: rule.interrogation_percent === null ? null : {
      interrogation: Number(rule.interrogation_percent), devoir: Number(rule.devoir_percent), composition: Number(rule.composition_percent),
    },
  }
}
