import { rankDirectory, type DirectoryHaystack } from "./directory-search"

export const ENROLLMENT_TYPE_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle inscription",
  reinscription: "Réinscription",
}

export type DirectoryStudent = {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string | null
  previous_school?: string | null
  previous_class?: string | null
  enrollments?: {
    grade_levels?: { name: string } | null
    classes?: { name: string } | null
  }[]
}

export type DirectoryGuardian = {
  id: string
  full_name: string
  phone: string
  email?: string | null
  relation?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  enrollments?: {
    student_id?: string
    students?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  }[]
}

export type DirectoryEnrollment = {
  id: string
  student_id?: string | null
  matricule?: string | null
  status?: string | null
  enrollment_type?: string | null
  orientation_number?: string | null
  students?: { first_name: string; last_name: string } | null
  guardians?: { full_name: string; phone: string } | null
  grade_levels?: { name: string } | null
  classes?: { name: string } | null
  academic_years?: { label: string } | null
}

export type DirectoryPreEnrollment = {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string | null
  code?: string | null
  status?: string | null
  grade_levels?: { name: string } | null
  guardian_phone?: string | null
  guardian_name?: string | null
  guardian_relation?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  previous_school?: string | null
  previous_class?: string | null
  previous_matricule?: string | null
  orientation_number?: string | null
  birth_certificate_number?: string | null
  enrollment_type?: string | null
}

export type DirectoryTeacher = {
  id: string
  full_name: string
}

export type DirectorySnapshot = {
  students: DirectoryStudent[]
  guardians: DirectoryGuardian[]
  enrollments: DirectoryEnrollment[]
  preEnrollments: DirectoryPreEnrollment[]
  teachers: DirectoryTeacher[]
}

export type SearchKind = "student" | "guardian" | "pre-enrollment" | "enrollment" | "teacher"

export type SearchHit = {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  href: string
}

export function guardianChildNames(guardian: DirectoryGuardian): string[] {
  const names: string[] = []
  for (const row of guardian.enrollments ?? []) {
    const students = row.students
    const list = Array.isArray(students) ? students : students ? [students] : []
    for (const student of list) {
      names.push(`${student.last_name} ${student.first_name}`.trim())
    }
  }
  return names
}

export function enrollmentsByStudent(enrollments: DirectoryEnrollment[]): Map<string, DirectoryEnrollment[]> {
  const map = new Map<string, DirectoryEnrollment[]>()
  for (const enrollment of enrollments) {
    if (!enrollment.student_id) continue
    const list = map.get(enrollment.student_id)
    if (list) list.push(enrollment)
    else map.set(enrollment.student_id, [enrollment])
  }
  return map
}

export function preEnrollmentHaystack(pre: DirectoryPreEnrollment): DirectoryHaystack {
  return {
    texts: [
      pre.last_name,
      pre.first_name,
      `${pre.last_name} ${pre.first_name}`,
      pre.guardian_name,
      pre.guardian_relation,
      pre.grade_levels?.name,
      pre.previous_school,
      pre.previous_class,
      pre.emergency_contact_name,
    ],
    phones: [pre.guardian_phone, pre.emergency_contact_phone],
    codes: [pre.code, pre.previous_matricule, pre.orientation_number, pre.birth_certificate_number],
  }
}

export function studentHaystack(
  student: DirectoryStudent,
  byStudentId: Map<string, DirectoryEnrollment[]>,
): DirectoryHaystack {
  const related = byStudentId.get(student.id) ?? []
  return {
    texts: [
      student.last_name,
      student.first_name,
      `${student.last_name} ${student.first_name}`,
      student.previous_school,
      student.previous_class,
      student.enrollments?.[0]?.grade_levels?.name,
      student.enrollments?.[0]?.classes?.name,
      ...related.map((e) => e.guardians?.full_name),
      ...related.map((e) => e.grade_levels?.name),
      ...related.map((e) => e.classes?.name),
    ],
    phones: related.map((e) => e.guardians?.phone),
    codes: related.map((e) => e.matricule),
  }
}

export function guardianHaystack(guardian: DirectoryGuardian): DirectoryHaystack {
  const children = guardianChildNames(guardian)
  return {
    texts: [
      guardian.full_name,
      guardian.email,
      guardian.relation,
      guardian.emergency_contact_name,
      ...children,
    ],
    phones: [guardian.phone, guardian.emergency_contact_phone],
  }
}

export function enrollmentHaystack(enrollment: DirectoryEnrollment): DirectoryHaystack {
  return {
    texts: [
      enrollment.students?.last_name,
      enrollment.students?.first_name,
      `${enrollment.students?.last_name ?? ""} ${enrollment.students?.first_name ?? ""}`,
      enrollment.guardians?.full_name,
      enrollment.grade_levels?.name,
      enrollment.classes?.name,
      enrollment.academic_years?.label,
      enrollment.enrollment_type && ENROLLMENT_TYPE_LABELS[enrollment.enrollment_type],
    ],
    phones: [enrollment.guardians?.phone],
    codes: [enrollment.matricule, enrollment.orientation_number],
  }
}

export function teacherHaystack(teacher: DirectoryTeacher): DirectoryHaystack {
  return { texts: [teacher.full_name] }
}

const TAB_HREF: Record<SearchKind, string> = {
  student: "/dashboard/direction/admissions?tab=students",
  guardian: "/dashboard/direction/admissions?tab=guardians",
  "pre-enrollment": "/dashboard/direction/admissions?tab=pre-enrollments",
  enrollment: "/dashboard/direction/admissions?tab=enrollments",
  teacher: "/dashboard/academic-structure",
}

export function buildSearchHits(snapshot: DirectorySnapshot, query: string, limitPerKind = 5): SearchHit[] {
  if (!query.trim()) return []

  const byStudentId = enrollmentsByStudent(snapshot.enrollments)
  const hits: SearchHit[] = []

  const students = rankDirectory(snapshot.students, query, (s) => studentHaystack(s, byStudentId)).slice(0, limitPerKind)
  for (const student of students) {
    const related = byStudentId.get(student.id)?.[0]
    const grade = student.enrollments?.[0]?.grade_levels?.name
    const klass = student.enrollments?.[0]?.classes?.name
    hits.push({
      id: student.id,
      kind: "student",
      title: `${student.last_name} ${student.first_name}`.trim(),
      subtitle: [related?.matricule, grade, klass, related?.guardians?.full_name].filter(Boolean).join(" · "),
      href: TAB_HREF.student,
    })
  }

  const guardians = rankDirectory(snapshot.guardians, query, guardianHaystack).slice(0, limitPerKind)
  for (const guardian of guardians) {
    const children = guardianChildNames(guardian)
    hits.push({
      id: guardian.id,
      kind: "guardian",
      title: guardian.full_name,
      subtitle: [guardian.phone, children.length ? children.join(", ") : null].filter(Boolean).join(" · "),
      href: TAB_HREF.guardian,
    })
  }

  const pres = rankDirectory(snapshot.preEnrollments, query, preEnrollmentHaystack).slice(0, limitPerKind)
  for (const pre of pres) {
    hits.push({
      id: pre.id,
      kind: "pre-enrollment",
      title: `${pre.last_name} ${pre.first_name}`.trim(),
      subtitle: [pre.code, pre.grade_levels?.name, pre.guardian_phone].filter(Boolean).join(" · "),
      href: TAB_HREF["pre-enrollment"],
    })
  }

  const enrollments = rankDirectory(snapshot.enrollments, query, enrollmentHaystack).slice(0, limitPerKind)
  for (const enrollment of enrollments) {
    hits.push({
      id: enrollment.id,
      kind: "enrollment",
      title: enrollment.matricule || "Sans matricule",
      subtitle: [
        `${enrollment.students?.last_name ?? ""} ${enrollment.students?.first_name ?? ""}`.trim(),
        enrollment.grade_levels?.name,
        enrollment.guardians?.full_name,
      ]
        .filter(Boolean)
        .join(" · "),
      href: TAB_HREF.enrollment,
    })
  }

  const teachers = rankDirectory(snapshot.teachers, query, teacherHaystack).slice(0, limitPerKind)
  for (const teacher of teachers) {
    hits.push({
      id: teacher.id,
      kind: "teacher",
      title: teacher.full_name,
      subtitle: "Professeur",
      href: TAB_HREF.teacher,
    })
  }

  return hits
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  student: "Élèves",
  guardian: "Tuteurs",
  "pre-enrollment": "Pré-inscriptions",
  enrollment: "Inscriptions",
  teacher: "Professeurs",
}
