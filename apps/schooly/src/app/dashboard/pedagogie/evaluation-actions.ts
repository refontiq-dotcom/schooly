"use server"

import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { DECISION_ROLES, TEACHING_ROLES } from "@/utils/supabase/roles"
import { validateRules, computeSubjectAverage, computePeriodAverage, type Category } from "@/lib/evaluation/calculations"
import { toRules, type EvaluationRule, type EvaluationPeriod } from "./evaluation-types"
import { revalidatePath } from "next/cache"

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim()
const number = (form: FormData, key: string) => text(form, key) === "" ? NaN : Number(text(form, key))

export async function getEvaluationConfiguration() {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const school = guard.context.schoolId
  const [rules, periods] = await Promise.all([
    db.from("evaluation_rules").select("*").eq("school_id", school),
    db.from("evaluation_periods").select("*").eq("school_id", school).order("position"),
  ])
  if (rules.error || periods.error) return { error: rules.error?.message ?? periods.error?.message }
  return { data: { rules: rules.data as EvaluationRule[], periods: periods.data as EvaluationPeriod[] } }
}

export async function createEvaluationRule(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const configured = text(form, "weighted") === "on"
  const row = {
    school_id: guard.context.schoolId, academic_year_id: text(form, "yearId"), cycle: text(form, "cycle") || "*",
    mode: text(form, "mode"), scale: number(form, "scale"), threshold: number(form, "threshold"), rescue_margin: number(form, "rescueMargin"),
    interrogation_percent: configured ? number(form, "interrogation") : null,
    devoir_percent: configured ? number(form, "devoir") : null,
    composition_percent: configured ? number(form, "composition") : null,
  }
  try { validateRules(toRules(row as Omit<EvaluationRule, "id">)) } catch (error) {
    return { error: error instanceof Error ? error.message : "Paramètres invalides." }
  }
  const { error } = await db.from("evaluation_rules").insert(row)
  revalidatePath("/dashboard/pedagogie/grades")
  return error ? { error: error.message } : {}
}

export async function createEvaluationPeriod(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const start = text(form, "start"), end = text(form, "end")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { error: "Dates requises." }
  const { error } = await db.from("evaluation_periods").insert({
    school_id: guard.context.schoolId, rule_id: text(form, "ruleId"), label: text(form, "label"),
    position: number(form, "position"), is_passage: text(form, "passage") === "on",
    starts_at: `${start}T00:00:00Z`, ends_at: `${end}T00:00:00Z`,
  })
  revalidatePath("/dashboard/pedagogie/grades")
  return error ? { error: error.message } : {}
}

export async function closeEvaluationPeriod(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await db.from("evaluation_periods").update({ locked_at: new Date().toISOString() })
    .eq("id", text(form, "periodId")).eq("school_id", guard.context.schoolId).is("locked_at", null).select("id")
  revalidatePath("/dashboard/pedagogie/grades")
  return error ? { error: error.message } : data?.length ? {} : { error: "Période introuvable ou déjà clôturée." }
}

export type PeriodResult = { enrollmentId: string; name: string; average: number | null; coverage: string; scale: number }

export async function getPeriodResults(classId: string, periodId: string): Promise<{ error?: string; data?: PeriodResult[] }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const school = guard.context.schoolId
  const { data: period, error: periodError } = await db.from("evaluation_periods").select("rule_id").eq("id", periodId).eq("school_id", school).single()
  if (periodError || !period) return { error: "Période introuvable." }
  const { data: rule } = await db.from("evaluation_rules").select("*").eq("id", period.rule_id).eq("school_id", school).single()
  if (!rule) return { error: "Règles introuvables." }
  const [enrollments, assignments, grades] = await Promise.all([
    db.from("enrollments").select("id,students(first_name,last_name)").eq("school_id", school).eq("class_id", classId).eq("academic_year_id", rule.academic_year_id).is("deleted_at", null),
    db.from("class_subject_assignments").select("subject_id,coefficient").eq("school_id", school).eq("class_id", classId).is("deleted_at", null),
    db.from("grade_entries").select("enrollment_id,subject_id,value,max_value,weight,grade_type,absence_status").eq("school_id", school).eq("period_id", periodId).is("deleted_at", null),
  ])
  const error = enrollments.error ?? assignments.error ?? grades.error
  if (error) return { error: error.message }
  try {
    const rules = toRules(rule as EvaluationRule)
    const data = (enrollments.data ?? []).map(enrollment => {
      const subjects = (assignments.data ?? []).map(assignment => ({
        coefficient: Number(assignment.coefficient),
        average: computeSubjectAverage((grades.data ?? []).filter(g => g.enrollment_id === enrollment.id && g.subject_id === assignment.subject_id).map(g => ({
          value: g.value === null ? null : Number(g.value), maxValue: Number(g.max_value), weight: Number(g.weight),
          category: (["interrogation", "composition"].includes(g.grade_type) ? g.grade_type : "devoir") as Category,
          status: g.absence_status as "graded" | "excused",
        })), rules),
      }))
      const student = enrollment.students as unknown as { first_name: string; last_name: string } | null
      return { enrollmentId: enrollment.id, name: `${student?.last_name ?? ""} ${student?.first_name ?? ""}`.trim(),
        average: computePeriodAverage(subjects).value, coverage: `${subjects.filter(s => s.average.value !== null).length}/${subjects.length}`, scale: rules.scale }
    })
    return { data: data.sort((a, b) => (b.average ?? -1) - (a.average ?? -1)) }
  } catch (error) { return { error: error instanceof Error ? error.message : "Calcul impossible." } }
}
