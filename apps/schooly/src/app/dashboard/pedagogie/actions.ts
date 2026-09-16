"use server"

import { createClient } from "@/utils/supabase/server"
import { DECISION_ROLES, REF_ROLES, TEACHING_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import {
  denial,
  requireSchoolRole,
  type SupabaseUserClient,
} from "@/utils/supabase/require-role"

/**
 * Module Pédagogie — cours, appels, devoirs, notes, décisions, moyennes.
 *
 * Sécurisation (audit P1-2) : chaque action est gardée par `requireSchoolRole`.
 * Les écritures pédagogiques utilisent TEACHING_ROLES ; les décisions
 * académiques (passage/redoublement/exclusion) sont un acte de direction
 * (DECISION_ROLES). Le `school_id` est TOUJOURS résolu depuis la session —
 * jamais depuis le formulaire (anti-injection cross-tenant).
 */

export type ActionResult<T = void> = {
  error?: string
  data?: T
  success?: boolean
}

/**
 * Embed PostgREST d'une relation many-to-one : l'API renvoie un **objet**
 * (ou null si absente) — forme consommée par les pages. La variante tableau
 * n'existe que pour les relations one-to-many, non utilisées ici.
 */
type Embed<T> = T | null

type StudentRef = { id: string; first_name: string | null; last_name: string | null }
type ClassRef = { id: string; name: string | null }
type SubjectRef = { id: string; name: string | null }
type UserRef = { full_name: string | null }

/**
 * Cast d'un résultat PostgREST vers des lignes typées. Sans schéma DB généré,
 * supabase-js typise les embeds comme des tableaux alors que le runtime renvoie
 * des objets pour les relations many-to-one : le passage par `unknown` documente
 * ce choix plutôt que de laisser un cast direct que TS refuse.
 */
function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[]
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Garde courte pour les écritures pédagogiques (session + école + rôle). */
async function teachingGuard(supabase: SupabaseUserClient, roles: readonly string[]) {
  return requireSchoolRole(supabase, { allowedRoles: [...roles] })
}

// ─── Course Sessions ──────────────────────────────────────────────────────────

export type CourseSessionRow = {
  id: string
  starts_at: string
  ends_at: string
  room: string | null
  notes: string | null
  class_id: string | null
  classes: Embed<ClassRef>
  subject_id: string | null
  subjects: Embed<SubjectRef>
  teacher_id: string | null
  users: Embed<UserRef>
  academic_year_id: string | null
}

export async function getCourseSessions(): Promise<ActionResult<CourseSessionRow[]>> {
  const supabase = await createClient()

  // Lecture du planning : tout membre actif (professeurs, direction, vie scolaire).
  const guard = await requireSchoolRole(supabase)
  if (!guard.ok) return denial(guard.reason, [])
  const schoolId = guard.context.schoolId

  const { data, error } = await adminClient()
    .from("course_sessions")
    .select(
      `id,
       starts_at,
       ends_at,
       room,
       notes,
       class_id,
       classes (id, name),
       subject_id,
       subjects (id, name),
       teacher_id,
       users (full_name),
       academic_year_id`
    )
    .eq("school_id", schoolId)
    .order("starts_at", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: asRows<CourseSessionRow>(data) }
}

export async function createCourseSession(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Seul un enseignant (ou la direction) planifie un cours.
  const guard = await teachingGuard(supabase, TEACHING_ROLES)
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { schoolId } = guard.context

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const teacherId = formData.get("teacherId") as string
  const academicYearId = formData.get("academicYearId") as string
  const startsAt = formData.get("startsAt") as string
  const endsAt = formData.get("endsAt") as string
  const room = formData.get("room") as string

  if (!classId || !subjectId || !teacherId || !academicYearId || !startsAt || !endsAt) {
    return { error: "Classe, matière, enseignant, année et horaires sont requis." }
  }

  const { error } = await adminClient().from("course_sessions").insert({
    school_id: schoolId,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: teacherId,
    academic_year_id: academicYearId,
    starts_at: startsAt,
    ends_at: endsAt,
    room: room || null,
    notes: null,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie")
  return { success: true }
}

// ─── Appels (attendance) ──────────────────────────────────────────────────────

export type EnrollmentRef = {
  id: string
  students: Embed<StudentRef>
  classes: Embed<ClassRef>
}

export type AttendanceRecordRow = {
  id: string
  status: string
  remark: string | null
  recorded_at: string
  recorded_by: string | null
  users: Embed<UserRef>
  enrollment_id: string
  enrollments: Embed<EnrollmentRef>
}

export async function getAttendanceForSession(
  sessionId: string
): Promise<ActionResult<AttendanceRecordRow[]>> {
  const supabase = await createClient()

  // Lecture d'une feuille d'appel : acteurs pédagogiques.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("attendance_records")
    .select(
      `id,
       status,
       remark,
       recorded_at,
       recorded_by,
       users (full_name),
       enrollment_id,
       enrollments (
         id,
         students (id, first_name, last_name),
         classes (id, name)
       )`
    )
    .eq("course_session_id", sessionId)
    .eq("school_id", guard.context.schoolId)

  if (error) return { error: error.message, data: [] }
  return { data: asRows<AttendanceRecordRow>(data) }
}

export async function recordAttendance(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Saisie de l'appel : enseignant ou direction.
  const guard = await teachingGuard(supabase, TEACHING_ROLES)
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { schoolId, userId } = guard.context

  const sessionId = formData.get("sessionId") as string
  const enrollmentId = formData.get("enrollmentId") as string
  const status = formData.get("status") as "present" | "absent" | "tardy" | "excused"
  const remark = formData.get("remark") as string

  if (!sessionId || !enrollmentId || !status) {
    return { error: "Session, élève et statut sont requis." }
  }

  const { error } = await adminClient()
    .from("attendance_records")
    .upsert(
      {
        school_id: schoolId,
        course_session_id: sessionId,
        enrollment_id: enrollmentId,
        status,
        remark: remark || null,
        recorded_by: userId,
      },
      { onConflict: "course_session_id,enrollment_id" }
    )

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie/attendance")
  return { success: true }
}

// ─── Devoirs (homeworks) ──────────────────────────────────────────────────────

export type HomeworkRow = {
  id: string
  title: string
  description: string | null
  due_date: string
  supports: string | null
  is_published: boolean | null
  class_id: string | null
  classes: Embed<ClassRef>
  subject_id: string | null
  subjects: Embed<SubjectRef>
  teacher_id: string | null
  users: Embed<UserRef>
}

export async function getHomeworks(): Promise<ActionResult<HomeworkRow[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("homeworks")
    .select(
      `id,
       title,
       description,
       due_date,
       supports,
       is_published,
       class_id,
       classes (id, name),
       subject_id,
       subjects (id, name),
       teacher_id,
       users (full_name)`
    )
    .eq("school_id", guard.context.schoolId)
    .order("due_date", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: asRows<HomeworkRow>(data) }
}

export async function createHomework(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const guard = await teachingGuard(supabase, TEACHING_ROLES)
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { schoolId, userId } = guard.context

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const dueDate = formData.get("dueDate") as string

  if (!classId || !subjectId || !title || !dueDate) {
    return { error: "Classe, matière, titre et date d'échéance sont requis." }
  }

  const { error } = await adminClient().from("homeworks").insert({
    school_id: schoolId,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: userId,
    title,
    description: description || null,
    due_date: dueDate,
    supports: "[]",
    is_published: false,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie")
  return { success: true }
}

// ─── Notes (grade entries) ────────────────────────────────────────────────────

export type GradeEntryRow = {
  id: string
  grade_type: string
  label: string | null
  value: number
  max_value: number
  weight: number
  comment: string | null
  created_at: string
  created_by: string | null
  users: Embed<UserRef>
  enrollment_id: string
  enrollments: Embed<EnrollmentRef>
  subject_id: string | null
  subjects: Embed<SubjectRef>
}

export async function getGradeEntries(): Promise<ActionResult<GradeEntryRow[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("grade_entries")
    .select(
      `id,
       grade_type,
       label,
       value,
       max_value,
       weight,
       comment,
       created_at,
       created_by,
       users (full_name),
       enrollment_id,
       enrollments (
         id,
         students (id, first_name, last_name),
         classes (id, name)
       ),
       subject_id,
       subjects (id, name)`
    )
    .eq("school_id", guard.context.schoolId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: asRows<GradeEntryRow>(data) }
}

export async function createGradeEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const guard = await teachingGuard(supabase, TEACHING_ROLES)
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { schoolId, userId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const subjectId = formData.get("subjectId") as string
  const academicYearId = formData.get("academicYearId") as string
  const gradeType = formData.get("gradeType") as string
  const label = formData.get("label") as string
  const value = parseFloat(formData.get("value") as string)
  const maxValue = parseFloat(formData.get("maxValue") as string) || 20
  const weight = parseFloat(formData.get("weight") as string) || 1
  const comment = formData.get("comment") as string

  if (!enrollmentId || !subjectId || !academicYearId || !gradeType || Number.isNaN(value)) {
    return { error: "Élève, matière, année, type de note et valeur valide sont requis." }
  }

  const { error } = await adminClient().from("grade_entries").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    subject_id: subjectId,
    academic_year_id: academicYearId,
    grade_type: gradeType,
    label: label || null,
    value,
    max_value: maxValue,
    weight,
    comment: comment || null,
    created_by: userId,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie/grades")
  return { success: true }
}

// ─── Décisions académiques (passage / redoublement / exclusion) ───────────────

export type AcademicDecisionRow = {
  id: string
  decision: string
  average: number | null
  observations: string | null
  decided_by: string | null
  decided_at: string
  enrollment_id: string
  enrollments: Embed<EnrollmentRef>
  academic_year_id: string | null
  academic_years: Embed<{ label: string | null }>
}

export async function getAcademicDecisions(): Promise<ActionResult<AcademicDecisionRow[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("academic_decisions")
    .select(
      `id,
       decision,
       average,
       observations,
       decided_by,
       decided_at,
       enrollment_id,
       enrollments (
         id,
         students (id, first_name, last_name),
         classes (id, name)
       ),
       academic_year_id,
       academic_years (label)`
    )
    .eq("school_id", guard.context.schoolId)
    .order("decided_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: asRows<AcademicDecisionRow>(data) }
}

export async function createAcademicDecision(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Un acte de direction : passage, redoublement, exclusion.
  const guard = await teachingGuard(supabase, DECISION_ROLES)
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  const { schoolId, userId } = guard.context

  const enrollmentId = formData.get("enrollmentId") as string
  const academicYearId = formData.get("academicYearId") as string
  const decision = formData.get("decision") as string
  const average = parseFloat(formData.get("average") as string)
  const observations = formData.get("observations") as string

  if (!enrollmentId || !academicYearId || !decision) {
    return { error: "Élève, année académique et décision sont requis." }
  }

  const { error } = await adminClient().from("academic_decisions").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    academic_year_id: academicYearId,
    decision,
    average: Number.isNaN(average) ? null : average,
    observations: observations || null,
    decided_by: userId,
    decided_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie")
  return { success: true }
}

// ─── Dropdown Data (référentiel) ──────────────────────────────────────────────

export async function getClassesForSchool(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const supabase = await createClient()

  // Référentiel suivi par la pédagogie ET la vie scolaire.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("classes")
    .select("id, name")
    .eq("school_id", guard.context.schoolId)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function getSubjectsForSchool(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("subjects")
    .select("id, name")
    .eq("school_id", guard.context.schoolId)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function getTeachersForSchool(): Promise<ActionResult<{ id: string; full_name: string }[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  // On récupère les utilisateurs qui ont le rôle professeur dans CETTE école.
  const admin = adminClient()
  const { data: roles, error: rolesError } = await admin
    .from("user_school_roles")
    .select("user_id")
    .eq("school_id", guard.context.schoolId)
    .eq("role_code", "professeur")
    .eq("is_active", true)

  if (rolesError) return { error: rolesError.message, data: [] }
  if (!roles || roles.length === 0) return { data: [] }

  const userIds = roles.map((r) => r.user_id)

  const { data, error } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", userIds)
    .order("full_name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export type EnrollmentListRow = {
  id: string
  students: Embed<StudentRef>
  classes: Embed<ClassRef>
}

export async function getEnrollmentsForSchool(): Promise<ActionResult<EnrollmentListRow[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("enrollments")
    .select(`
      id,
      students (id, first_name, last_name),
      classes (id, name)
    `)
    .eq("school_id", guard.context.schoolId)
    .order("students ( last_name, first_name )", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: asRows<EnrollmentListRow>(data) }
}

export async function getAcademicYearsForSchool(): Promise<ActionResult<{ id: string; label: string; status: string }[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("academic_years")
    .select("id, label, status")
    .eq("school_id", guard.context.schoolId)
    .order("start_date", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

// ─── Moyenne Calculation ──────────────────────────────────────────────────────

type GradeRow = { value: number; weight: number; max_value: number }
type SubjectIdRow = { subject_id: string }
type ClassAverageRow = { enrollment_id: string; student_name: string; average: number }

type ClassEnrollmentRow = { id: string; students: Embed<StudentRef> }

/** Nom affiché d'un élève, tolérant à une éventuelle forme tableau de l'embed. */
function studentName(enrollment: ClassEnrollmentRow): string {
  const students = enrollment.students as StudentRef | StudentRef[] | null
  const student = Array.isArray(students) ? students[0] : students
  return `${student?.last_name ?? ""} ${student?.first_name ?? ""}`.trim()
}

export async function calculateStudentAverage(
  enrollmentId: string,
  subjectId: string,
  academicYearId: string
): Promise<ActionResult<{ average: number; totalCoef: number; entriesCount: number }>> {
  const supabase = await createClient()

  // Une moyenne est une donnée de suivi élève : acteurs pédagogiques.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  // Récupérer toutes les notes pour cet élève, cette matière et cette année.
  const { data: grades, error } = await adminClient()
    .from("grade_entries")
    .select("value, weight, max_value")
    .eq("school_id", guard.context.schoolId)
    .eq("enrollment_id", enrollmentId)
    .eq("subject_id", subjectId)
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)

  if (error) return { error: error.message }

  if (!grades || grades.length === 0) {
    return { data: { average: 0, totalCoef: 0, entriesCount: 0 } }
  }

  // Calcul pondéré : somme(note normalisée sur 20 × poids) / somme(poids).
  let weightedSum = 0
  let totalWeight = 0

  for (const grade of grades as GradeRow[]) {
    const normalizedValue = (grade.value / grade.max_value) * 20
    weightedSum += normalizedValue * grade.weight
    totalWeight += grade.weight
  }

  const average = totalWeight > 0 ? weightedSum / totalWeight : 0

  return {
    data: {
      average: Math.round(average * 100) / 100,
      totalCoef: totalWeight,
      entriesCount: grades.length,
    },
  }
}

export async function calculateClassAverages(
  classId: string,
  academicYearId: string
): Promise<ActionResult<ClassAverageRow[]>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...REF_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const admin = adminClient()
  const schoolId = guard.context.schoolId

  // Récupérer tous les enrollments pour cette classe.
  const { data: enrollments, error: enrollmentsError } = await admin
    .from("enrollments")
    .select("id, students (first_name, last_name)")
    .eq("school_id", schoolId)
    .eq("class_id", classId)

  if (enrollmentsError) return { error: enrollmentsError.message, data: [] }
  if (!enrollments || enrollments.length === 0) return { data: [] }

  // Les matières d'une classe ne dépendent pas de l'élève : une seule requête
  // (l'original les re-chargeait dans la boucle — N+1 supprimé, même résultat).
  const { data: subjects, error: subjectsError } = await admin
    .from("class_subject_assignments")
    .select("subject_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)

  const subjectList = (subjectsError ? null : subjects) as SubjectIdRow[] | null

  const results: ClassAverageRow[] = []

  for (const enrollment of asRows<ClassEnrollmentRow>(enrollments)) {
    if (!subjectList || subjectList.length === 0) {
      results.push({
        enrollment_id: enrollment.id,
        student_name: studentName(enrollment),
        average: 0,
      })
      continue
    }

    // Calculer la moyenne pour chaque matière.
    let totalWeightedScore = 0
    let totalWeight = 0

    for (const subject of subjectList) {
      const { data: gradeRows, error: avgError } = await admin
        .from("grade_entries")
        .select("value, weight, max_value")
        .eq("school_id", schoolId)
        .eq("enrollment_id", enrollment.id)
        .eq("subject_id", subject.subject_id)
        .eq("academic_year_id", academicYearId)
        .is("deleted_at", null)

      if (avgError || !gradeRows) continue

      for (const grade of gradeRows as GradeRow[]) {
        const normalizedValue = (grade.value / grade.max_value) * 20
        totalWeightedScore += normalizedValue * grade.weight
        totalWeight += grade.weight
      }
    }

    const average = totalWeight > 0 ? totalWeightedScore / totalWeight : 0

    results.push({
      enrollment_id: enrollment.id,
      student_name: studentName(enrollment),
      average: Math.round(average * 100) / 100,
    })
  }

  // Trier par moyenne décroissante.
  results.sort((a, b) => b.average - a.average)

  return { data: results }
}