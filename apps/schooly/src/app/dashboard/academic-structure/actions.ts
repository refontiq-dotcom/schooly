"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  requireSchoolRole,
  type SupabaseUserClient,
} from "@/utils/supabase/require-role"
import { STRUCTURE_ADMIN_ROLES } from "@/utils/supabase/roles"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

export type { SchoolRoleResult }

type SchoolRoleResult = { school_id: string | null; error: Error | null }

async function getSchoolId(supabase: SupabaseUserClient): Promise<SchoolRoleResult> {
  // Audit P2-2 : garde partagée requireSchoolRole + source unique des rôles.
  // La structure académique (années, niveaux, classes, matières, affectations)
  // est un acte de direction ou de secrétariat — pas une opération enseignante.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...STRUCTURE_ADMIN_ROLES] })
  if (!guard.ok) return { school_id: null, error: new Error(guard.reason) }
  return { school_id: guard.context.schoolId, error: null }
}

export async function getAcademicYears(): Promise<ActionResult<{ id: string; label: string; status: string; start_date: string; end_date: string }[]>> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("academic_years")
    .select("id, label, status, start_date, end_date")
    .eq("school_id", roleData.school_id)
    .order("start_date", { ascending: false })

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createAcademicYear(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const label = formData.get("label") as string
  const startDate = formData.get("startDate") as string
  const endDate = formData.get("endDate") as string
  const status = formData.get("status") as string

  if (!label || !startDate || !endDate) {
    return { error: "Label, date de début et date de fin sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("academic_years").insert({
    school_id: roleData.school_id,
    label,
    start_date: startDate,
    end_date: endDate,
    status: status || "planifiee",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getGradeLevels() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("grade_levels")
    .select("*")
    .eq("school_id", roleData.school_id)
    .order("level", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createGradeLevel(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const name = formData.get("name") as string
  const level = parseInt(formData.get("level") as string || "0")
  const cycle = formData.get("cycle") as string

  if (!name || !level || !cycle) {
    return { error: "Nom, niveau et cycle sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("grade_levels").insert({
    school_id: roleData.school_id,
    name,
    level,
    cycle,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getClasses() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("classes")
    .select(`
      *,
      grade_levels ( name ),
      users ( full_name )
    `)
    .eq("school_id", roleData.school_id)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const gradeLevelId = formData.get("gradeLevelId") as string
  const name = formData.get("name") as string
  const capacity = formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null
  const headTeacherId = formData.get("headTeacherId") as string | null

  if (!gradeLevelId || !name) {
    return { error: "Niveau et nom de classe sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("classes").insert({
    school_id: roleData.school_id,
    grade_level_id: gradeLevelId,
    name,
    capacity,
    head_teacher_id: headTeacherId || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getSubjects() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("subjects")
    .select("*")
    .eq("school_id", roleData.school_id)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createSubject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const name = formData.get("name") as string
  const code = formData.get("code") as string | null
  const coefficient = parseFloat(formData.get("coefficient") as string || "1")

  if (!name) {
    return { error: "Nom de la matière est requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("subjects").insert({
    school_id: roleData.school_id,
    name,
    code,
    coefficient,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}

export async function getClassSubjectAssignments() {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("class_subject_assignments")
    .select(`
      *,
      classes ( name, grade_levels ( name ) ),
      subjects ( name ),
      users ( full_name )
    `)
    .eq("school_id", roleData.school_id)
    .order("classes ( name )", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createClassSubjectAssignment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const roleData = await getSchoolId(supabase)
  if (!roleData?.school_id) return { error: "Aucune école rattachée" }

  const classId = formData.get("classId") as string
  const subjectId = formData.get("subjectId") as string
  const teacherId = formData.get("teacherId") as string | null
  const coefficient = parseFloat(formData.get("coefficient") as string || "1")

  if (!classId || !subjectId) {
    return { error: "Classe et matière sont requises." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("class_subject_assignments").insert({
    school_id: roleData.school_id,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: teacherId || null,
    coefficient,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/academic-structure")
  return {}
}
