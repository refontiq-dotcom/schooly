"use server"

import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole, denial } from "@/utils/supabase/require-role"
import { DECISION_ROLES, TEACHING_ROLES } from "@/utils/supabase/roles"
import { validateRules, computePeriodAverage } from "@/lib/evaluation/calculations"
import { computeExpectedSubject, type EnteredGrade } from "@/lib/evaluation/completeness"
import { toRules, type EvaluationRule, type EvaluationPeriod, type EvaluationAssessment } from "./evaluation-types"
import { computeAnnualPreview, type AnnualPeriod } from "@/lib/evaluation/annual"
import { revalidateGrades } from "./grades/_lib/revalidate"

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
  revalidateGrades()
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
  revalidateGrades()
  return error ? { error: error.message } : {}
}

export async function closeEvaluationPeriod(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await db.from("evaluation_periods").update({ locked_at: new Date().toISOString() })
    .eq("id", text(form, "periodId")).eq("school_id", guard.context.schoolId).is("locked_at", null).select("id")
  revalidateGrades()
  return error ? { error: error.message } : data?.length ? {} : { error: "Période introuvable ou déjà clôturée." }
}

export async function getEvaluationAssessments() {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { data, error } = await db.from("evaluation_assessments").select("*").eq("school_id", guard.context.schoolId).order("created_at")
  return error ? { error: error.message } : { data: data as EvaluationAssessment[] }
}

export async function createEvaluationAssessment(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: TEACHING_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const maxValue = number(form, "maxValue"), weight = number(form, "weight")
  if (!text(form, "label") || !Number.isFinite(maxValue) || maxValue <= 0 || !Number.isFinite(weight) || weight < 0) {
    return { error: "Intitulé, barème positif et poids positif ou nul requis." }
  }
  const { error } = await db.from("evaluation_assessments").insert({
    school_id: guard.context.schoolId, created_by: guard.context.userId,
    period_id: text(form, "periodId"), class_id: text(form, "classId"), subject_id: text(form, "subjectId"),
    grade_type: text(form, "gradeType"), label: text(form, "label"), max_value: maxValue, weight,
  })
  if (error) return { error: error.message }
  revalidateGrades()
  return {}
}

export type PeriodResult = {
  enrollmentId: string; name: string; average: number | null; coverage: string; scale: number
  complete: boolean; expected: number; entered: number; unlinked: number
}

type Db = Awaited<ReturnType<typeof createClient>>

/** Calcul d'une période pour une classe : réutilisé par l'aperçu mensuel et annuel. */
async function loadPeriodResults(db: Db, school: string, rule: EvaluationRule, classId: string, periodId: string) {
  const [enrollments, assignments, grades, assessments] = await Promise.all([
    db.from("enrollments").select("id,students(first_name,last_name)").eq("school_id", school).eq("class_id", classId).eq("academic_year_id", rule.academic_year_id).is("deleted_at", null),
    db.from("class_subject_assignments").select("subject_id,coefficient").eq("school_id", school).eq("class_id", classId).is("deleted_at", null),
    db.from("grade_entries").select("enrollment_id,subject_id,assessment_id,value,max_value,weight,grade_type,absence_status").eq("school_id", school).eq("period_id", periodId).is("deleted_at", null),
    db.from("evaluation_assessments").select("*").eq("school_id", school).eq("period_id", periodId).eq("class_id", classId),
  ])
  const error = enrollments.error ?? assignments.error ?? grades.error ?? assessments.error
  if (error) return { error: error.message }
  try {
    const rules = toRules(rule)
    const data = (enrollments.data ?? []).map(enrollment => {
      const subjects = (assignments.data ?? []).map(assignment => ({
        coefficient: Number(assignment.coefficient),
        ...computeExpectedSubject(
          (assessments.data ?? []).filter(a => a.subject_id === assignment.subject_id) as EvaluationAssessment[],
          (grades.data ?? []).filter(g => g.enrollment_id === enrollment.id && g.subject_id === assignment.subject_id) as EnteredGrade[], rules),
      }))
      const average = computePeriodAverage(subjects)
      const student = enrollment.students as unknown as { first_name: string; last_name: string } | null
      return { enrollmentId: enrollment.id, name: `${student?.last_name ?? ""} ${student?.first_name ?? ""}`.trim(),
        average: average.value, complete: average.complete,
        entered: subjects.reduce((sum, s) => sum + s.entered, 0), expected: subjects.reduce((sum, s) => sum + s.expected, 0),
        unlinked: subjects.reduce((sum, s) => sum + s.unlinked, 0),
        coverage: `${subjects.filter(s => s.average.value !== null).length}/${subjects.length}`, scale: rules.scale }
    })
    return { data: data.sort((a, b) => (b.average ?? -1) - (a.average ?? -1)) }
  } catch (error) { return { error: error instanceof Error ? error.message : "Calcul impossible." } }
}

export async function getPeriodResults(classId: string, periodId: string): Promise<{ error?: string; data?: PeriodResult[] }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const school = guard.context.schoolId
  const { data: period, error: periodError } = await db.from("evaluation_periods").select("rule_id").eq("id", periodId).eq("school_id", school).single()
  if (periodError || !period) return { error: "Période introuvable." }
  const { data: rule } = await db.from("evaluation_rules").select("*").eq("id", period.rule_id).eq("school_id", school).single()
  if (!rule) return { error: "Règles introuvables." }
  return loadPeriodResults(db, school, rule as EvaluationRule, classId, periodId)
}

export type AnnualPreviewResult = {
  enrollmentId: string; name: string
  average: number | null; complete: boolean
  proposal: "admitted" | "rescuable" | "deferred" | "incomplete"
  allPeriodsClosed: boolean; readyForValidation: boolean; blockers: string[]
  fingerprint: string
}

/**
 * Aperçu annuel : cumul des périodes selon le régime. Règle de cycle
 * spécifique prioritaire, sinon règle de l'établissement (`*`).
 * N'enregistre AUCUNE décision : la validation officielle est un lot distinct.
 */
export async function getAnnualPreview(classId: string, academicYearId: string): Promise<{ error?: string; data?: AnnualPreviewResult[] }> {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const school = guard.context.schoolId

  const { data: klass, error: classError } = await db.from("classes")
    .select("id,grade_levels(cycle)").eq("id", classId).eq("school_id", school).is("deleted_at", null).single()
  if (classError || !klass) return { error: "Classe introuvable." }
  const cycle = (klass.grade_levels as unknown as { cycle: string } | null)?.cycle

  const { data: rules, error: rulesError } = await db.from("evaluation_rules")
    .select("*").eq("school_id", school).eq("academic_year_id", academicYearId)
  if (rulesError) return { error: rulesError.message }
  const candidates = (rules ?? []) as EvaluationRule[]
  const rule = candidates.find(r => r.cycle === cycle) ?? candidates.find(r => r.cycle === "*")
  if (!rule) return { error: "Aucune règle pour cette année et ce cycle." }

  const { data: periods, error: periodsError } = await db.from("evaluation_periods")
    .select("*").eq("school_id", school).eq("rule_id", rule.id).order("position")
  if (periodsError) return { error: periodsError.message }
  if (!periods || periods.length === 0) return { error: "Aucune période pour ces règles." }

  // Une requête par période : le cumul annuel réutilise le calcul de période,
  // seule source des moyennes par matière, complétude et notes hors évaluation.
  const perPeriod: { period: EvaluationPeriod; rows: Map<string, PeriodResult> }[] = []
  for (const period of periods as EvaluationPeriod[]) {
    const outcome = await loadPeriodResults(db, school, rule, classId, period.id)
    if (outcome.error) return { error: outcome.error }
    perPeriod.push({ period, rows: new Map((outcome.data ?? []).map(r => [r.enrollmentId, r])) })
  }

  try {
    const configured = toRules(rule)
    const now = Date.now()
    const first = perPeriod[0]
    const data: AnnualPreviewResult[] = [...first.rows.entries()].map(([enrollmentId, row]) => {
      const annualPeriods: AnnualPeriod[] = perPeriod.map(({ period, rows }) => {
        const result = rows.get(enrollmentId)
        return {
          id: period.id, position: period.position, isPassage: period.is_passage,
          startsAt: period.starts_at, endsAt: period.ends_at, lockedAt: period.locked_at,
          average: { value: result?.average ?? null, complete: result?.complete ?? false },
        }
      })
      const preview = computeAnnualPreview(annualPeriods, configured, now)
      return {
        enrollmentId, name: row.name, average: preview.average.value, complete: preview.average.complete,
        proposal: preview.proposal, allPeriodsClosed: preview.allPeriodsClosed,
        readyForValidation: preview.readyForValidation, blockers: preview.blockers, fingerprint: "",
      }
    })
    data.sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
    // L'empreinte vient de la base (source de vérité de la validation) : le client
    // ne la recalcule jamais, la RPC refusera toute donnée changée depuis l'aperçu.
    const fingerprints = await Promise.all(data.map(row =>
      db.rpc("annual_input_fingerprint", { p_enrollment_id: row.enrollmentId })))
    const fingerprintError = fingerprints.find(f => f.error)
    if (fingerprintError) return { error: "Empreinte des données indisponible." }
    fingerprints.forEach((f, index) => { data[index].fingerprint = String(f.data) })
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cumul annuel impossible." }
  }
}

/**
 * Validation officielle : appelle la RPC transactionnelle qui revérifie
 * l'empreinte, la clôture des périodes et la cohérence du seuil, puis fige
 * la décision. Échec explicite si les données ont changé depuis l'aperçu.
 */
export async function validateAnnualDecision(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const decision = text(form, "decision")
  const fingerprint = text(form, "fingerprint")
  const average = number(form, "average")
  if (!text(form, "enrollmentId") || !decision || !fingerprint || !Number.isFinite(average)
    || !["admitted", "repeated", "pending"].includes(decision)) {
    return { error: "Paramètres de validation incomplets." }
  }
  const { error } = await db.rpc("validate_annual_decision", {
    p_enrollment_id: text(form, "enrollmentId"), p_decision: decision, p_average: average,
    p_fingerprint: fingerprint, p_observations: text(form, "observations") || null,
  })
  if (error) return { error: error.message }
  revalidateGrades()
  return {}
}

/**
 * Génération des bulletins officiels d'une classe : uniquement les élèves à
 * décision validée, contenu figé calculé en SQL sur les notes gelées. Refus si
 * des données ont changé depuis la validation (empreinte).
 */
export async function generateReportCards(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  if (!text(form, "classId") || !text(form, "yearId")) return { error: "Classe et année requises." }
  const { error } = await db.rpc("generate_class_report_cards", {
    p_class_id: text(form, "classId"), p_academic_year_id: text(form, "yearId"),
  })
  if (error) return { error: error.message }
  revalidateGrades()
  return {}
}

/**
 * Publication : les bulletins générés de la classe deviennent visibles par les
 * parents et les élèves. Un bulletin publié devient immuable en base.
 */
export async function publishReportCards(form: FormData) {
  const db = await createClient()
  const guard = await requireSchoolRole(db, { allowedRoles: DECISION_ROLES })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  if (!text(form, "classId") || !text(form, "yearId")) return { error: "Classe et année requises." }
  const { error } = await db.rpc("publish_class_report_cards", {
    p_class_id: text(form, "classId"), p_academic_year_id: text(form, "yearId"),
  })
  if (error) return { error: error.message }
  revalidateGrades()
  return {}
}
