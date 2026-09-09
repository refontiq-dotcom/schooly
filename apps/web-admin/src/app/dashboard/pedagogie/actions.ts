"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActionResult<T = void> = {
  error?: string
  data?: T
  success?: boolean
}

type SchoolResult = { school_id: string | null; error: Error | null }

async function getSchoolId(userId: string): Promise<SchoolResult> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single()
  return { school_id: data?.school_id ?? null, error }
}

// ─── Course Sessions ────────────────────────────────────────────────────────

export async function getCourseSessions(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("course_sessions")
    .select(`
      id,
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
      academic_year_id
    `)
    .eq("school_id", roleData.school_id)
    .order("starts_at", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createCourseSession(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const teacherId = formData.get("teacherId") as string
  const academicYearId = formData.get("academicYearId") as string
  const startsAt = formData.get("startsAt") as string
  const endsAt = formData.get("endsAt") as string
  const room = formData.get("room") as string

  const { error } = await admin.from("course_sessions").insert({
    school_id: roleData.school_id,
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

// ─── Attendance Records ─────────────────────────────────────────────────────

export async function getAttendanceForSession(sessionId: string): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("attendance_records")
    .select(`
      id,
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
      )
    `)
    .eq("course_session_id", sessionId)
    .eq("school_id", roleData.school_id)

  if (error) return { error: error.message }
  return { data }
}

export async function recordAttendance(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sessionId = formData.get("sessionId") as string
  const enrollmentId = formData.get("enrollmentId") as string
  const status = formData.get("status") as "present" | "absent" | "tardy" | "excused"
  const remark = formData.get("remark") as string

  const { error } = await admin.from("attendance_records").upsert({
    school_id: roleData.school_id,
    course_session_id: sessionId,
    enrollment_id: enrollmentId,
    status: status,
    remark: remark || null,
    recorded_by: user.id,
  }, { onConflict: "course_session_id,enrollment_id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie/attendance")
  return { success: true }
}

// ─── Homeworks ──────────────────────────────────────────────────────────────

export async function getHomeworks(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("homeworks")
    .select(`
      id,
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
      users (full_name)
    `)
    .eq("school_id", roleData.school_id)
    .order("due_date", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

export async function createHomework(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const dueDate = formData.get("dueDate") as string

  const { error } = await admin.from("homeworks").insert({
    school_id: roleData.school_id,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: user.id,
    title: title,
    description: description || null,
    due_date: dueDate,
    supports: "[]",
    is_published: false,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie")
  return { success: true }
}

// ─── Grade Entries ──────────────────────────────────────────────────────────

export async function getGradeEntries(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("grade_entries")
    .select(`
      id,
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
      subjects (id, name)
    `)
    .eq("school_id", roleData.school_id)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function createGradeEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const enrollmentId = formData.get("enrollmentId") as string
  const subjectId = formData.get("subjectId") as string
  const academicYearId = formData.get("academicYearId") as string
  const gradeType = formData.get("gradeType") as string
  const label = formData.get("label") as string
  const value = parseFloat(formData.get("value") as string)
  const maxValue = parseFloat(formData.get("maxValue") as string) || 20
  const weight = parseFloat(formData.get("weight") as string) || 1
  const comment = formData.get("comment") as string

  const { error } = await admin.from("grade_entries").insert({
    school_id: roleData.school_id,
    enrollment_id: enrollmentId,
    subject_id: subjectId,
    academic_year_id: academicYearId,
    grade_type: gradeType,
    label: label,
    value: value,
    max_value: maxValue,
    weight: weight,
    comment: comment || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie/grades")
  return { success: true }
}

// ─── Academic Decisions ─────────────────────────────────────────────────────

export async function getAcademicDecisions(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("academic_decisions")
    .select(`
      id,
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
      academic_years (label)
    `)
    .eq("school_id", roleData.school_id)
    .order("decided_at", { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function createAcademicDecision(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const enrollmentId = formData.get("enrollmentId") as string
  const academicYearId = formData.get("academicYearId") as string
  const decision = formData.get("decision") as string
  const average = parseFloat(formData.get("average") as string) || null
  const observations = formData.get("observations") as string

  const { error } = await admin.from("academic_decisions").insert({
    school_id: roleData.school_id,
    enrollment_id: enrollmentId,
    academic_year_id: academicYearId,
    decision: decision,
    average: average,
    observations: observations || null,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/pedagogie")
  return { success: true }
}

// ─── Dropdown Data ─────────────────────────────────────────────────────

export async function getClassesForSchool(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", roleData.school_id)
    .order("name", { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getSubjectsForSchool(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("subjects")
    .select("id, name")
    .eq("school_id", roleData.school_id)
    .order("name", { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getTeachersForSchool(): Promise<ActionResult<{ id: string; full_name: string }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // On récupère les utilisateurs qui ont le rôle professeur
  const { data: roles, error: rolesError } = await admin
    .from("user_school_roles")
    .select("user_id")
    .eq("school_id", roleData.school_id)
    .eq("role_code", "professeur")
    .eq("is_active", true)

  if (rolesError) return { error: rolesError.message }

  if (!roles || roles.length === 0) return { data: [] }

  const userIds = roles.map(r => r.user_id)

  const { data, error } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", userIds)
    .order("full_name", { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getEnrollmentsForSchool(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("enrollments")
    .select(`
      id,
      students (id, first_name, last_name),
      classes (id, name)
    `)
    .eq("school_id", roleData.school_id)
    .order("students ( last_name, first_name )", { ascending: true })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getAcademicYearsForSchool(): Promise<ActionResult<{ id: string; label: string; status: string }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("academic_years")
    .select("id, label, status")
    .eq("school_id", roleData.school_id)
    .order("start_date", { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

// ─── Moyenne Calculation ──────────────────────────────────────────────

export async function calculateStudentAverage(
  enrollmentId: string,
  subjectId: string,
  academicYearId: string
): Promise<ActionResult<{ average: number; totalCoef: number; entriesCount: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer toutes les notes pour cet élève, cette matière et cette année
  const { data: grades, error } = await admin
    .from("grade_entries")
    .select("value, weight, max_value")
    .eq("school_id", roleData.school_id)
    .eq("enrollment_id", enrollmentId)
    .eq("subject_id", subjectId)
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)

  if (error) return { error: error.message }

  if (!grades || grades.length === 0) {
    return { data: { average: 0, totalCoef: 0, entriesCount: 0 } }
  }

  // Calcul pondéré : somme(note * poids) / somme(poids)
  // mais chaque note est sur max_value, donc on normalise
  let weightedSum = 0
  let totalWeight = 0

  for (const grade of grades) {
    const normalizedValue = (grade.value / grade.max_value) * 20 // normaliser sur 20
    weightedSum += normalizedValue * grade.weight
    totalWeight += grade.weight
  }

  // Moyenne sur 20
  const average = totalWeight > 0 ? weightedSum / totalWeight : 0

  return {
    data: {
      average: Math.round(average * 100) / 100, // arrondir à 2 décimales
      totalCoef: totalWeight,
      entriesCount: grades.length,
    },
  }
}

export async function calculateClassAverages(
  classId: string,
  academicYearId: string
): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const roleData = await getSchoolId(user.id)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer tous les enrollments pour cette classe
  const { data: enrollments, error: enrollmentsError } = await admin
    .from("enrollments")
    .select("id, students (first_name, last_name)")
    .eq("school_id", roleData.school_id)
    .eq("class_id", classId)

  if (enrollmentsError) return { error: enrollmentsError.message }

  if (!enrollments || enrollments.length === 0) {
    return { data: [] }
  }

  // Pour chaque élève, calculer la moyenne générale
  const results: any[] = []

  for (const enrollment of enrollments) {
    // Récupérer toutes les matières pour cette classe
    const { data: subjects, error: subjectsError } = await admin
      .from("class_subject_assignments")
      .select("subject_id")
      .eq("school_id", roleData.school_id)
      .eq("class_id", classId)

    if (subjectsError) continue

    if (!subjects || subjects.length === 0) {
      results.push({
        enrollment_id: enrollment.id,
        student_name: `${enrollment.students?.first_name} ${enrollment.students?.last_name}`,
        average: 0,
      })
      continue
    }

    // Calculer la moyenne pour chaque matière
    let totalWeightedScore = 0
    let totalWeight = 0

    for (const subject of subjects) {
      const { data: avgResult, error: avgError } = await admin
        .from("grade_entries")
        .select("value, weight, max_value")
        .eq("school_id", roleData.school_id)
        .eq("enrollment_id", enrollment.id)
        .eq("subject_id", subject.subject_id)
        .eq("academic_year_id", academicYearId)
        .is("deleted_at", null)

      if (avgError || !avgResult) continue

      for (const grade of avgResult) {
        const normalizedValue = (grade.value / grade.max_value) * 20
        totalWeightedScore += normalizedValue * grade.weight
        totalWeight += grade.weight
      }
    }

    const average = totalWeight > 0 ? totalWeightedScore / totalWeight : 0

    results.push({
      enrollment_id: enrollment.id,
      student_name: `${enrollment.students?.first_name} ${enrollment.students?.last_name}`,
      average: Math.round(average * 100) / 100,
    })
  }

  // Trier par moyenne décroissante
  results.sort((a, b) => b.average - a.average)

  return { data: results }
}
