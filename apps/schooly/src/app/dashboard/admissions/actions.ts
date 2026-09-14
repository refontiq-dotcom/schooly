"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import crypto from "crypto"

type ActionResult<T = void> = {
  error?: string
  data?: T
}

function generateCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ============================================ PRÉ-INSCRIPTIONS (PUBLIC) =====

export async function createPreEnrollment(formData: FormData): Promise<ActionResult<{ code: string }>> {
  const schoolId = formData.get("schoolId") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const dateOfBirth = formData.get("dateOfBirth") as string
  const gradeLevelId = formData.get("gradeLevelId") as string
  const guardianPhone = formData.get("guardianPhone") as string

  if (!schoolId || !firstName || !lastName || !dateOfBirth || !guardianPhone) {
    return { error: "Tous les champs sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let code = generateCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await admin
      .from("pre_enrollments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("code", code)
      .is("deleted_at", null)
      .single()
    
    if (!existing) break
    code = generateCode()
    attempts++
  }

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 72)

  const { error } = await admin.from("pre_enrollments").insert({
    school_id: schoolId,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    grade_level_id: gradeLevelId || null,
    guardian_phone: guardianPhone,
    code,
    status: "pending",
    expires_at: expiresAt.toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath("/register-school/[id]")
  return { data: { code } }
}

export async function getPreEnrollments(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("pre_enrollments")
    .select(`
      *,
      grade_levels ( name )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getPreEnrollmentByCode(schoolId: string, code: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from("pre_enrollments")
    .select(`
      *,
      grade_levels ( name )
    `)
    .eq("school_id", schoolId)
    .eq("code", code.toUpperCase())
    .is("deleted_at", null)
    .single()

  return data
}

export async function validatePreEnrollment(formData: FormData): Promise<ActionResult<{ matricule: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const preEnrollmentId = formData.get("preEnrollmentId") as string

  if (!preEnrollmentId) {
    return { error: "Pré-inscription introuvable." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: preEnrollment } = await admin
    .from("pre_enrollments")
    .select("*")
    .eq("id", preEnrollmentId)
    .single()

  if (!preEnrollment) return { error: "Pré-inscription introuvable." }
  if (preEnrollment.status !== "pending") return { error: "Cette pré-inscription a déjà été traitée." }
  if (new Date(preEnrollment.expires_at) < new Date()) return { error: "Cette pré-inscription a expiré." }

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!roleData?.school_id || roleData.school_id !== preEnrollment.school_id) {
    return { error: "Accès non autorisé." }
  }

  const studentId = crypto.randomUUID()
  const matricule = `${preEnrollment.school_id.slice(0, 4).toUpperCase()}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

  const { error: studentError } = await admin.from("students").insert({
    id: studentId,
    school_id: preEnrollment.school_id,
    first_name: preEnrollment.first_name,
    last_name: preEnrollment.last_name,
    date_of_birth: preEnrollment.date_of_birth,
    status: "active",
  })

  if (studentError) return { error: studentError.message }

  const { data: existingGuardian } = await admin
    .from("guardians")
    .select("id")
    .eq("phone", preEnrollment.guardian_phone)
    .single()

  let guardianId = existingGuardian?.id

  if (!guardianId) {
    const { data: newGuardian, error: guardianError } = await admin
      .from("guardians")
      .insert({
        phone: preEnrollment.guardian_phone,
        full_name: "À compléter",
      })
      .select("id")
      .single()

    if (guardianError) return { error: guardianError.message }
    guardianId = newGuardian.id
  }

  const { error: enrollmentError } = await admin.from("enrollments").insert({
    school_id: preEnrollment.school_id,
    student_id: studentId,
    guardian_id: guardianId,
    grade_level_id: preEnrollment.grade_level_id,
    academic_year_id: (await getCurrentAcademicYear(preEnrollment.school_id))?.id,
    status: "active",
    matricule,
  })

  if (enrollmentError) return { error: enrollmentError.message }

  await admin
    .from("pre_enrollments")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", preEnrollmentId)

  revalidatePath("/dashboard/direction/admissions")
  return { data: { matricule } }
}

async function getCurrentAcademicYear(schoolId: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "en_cours")
    .single()
  return data
}

// ============================================ TUTEURS =========================

export async function getGuardians(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("guardians")
    .select(`
      *,
      enrollments (
        student_id,
        students ( first_name, last_name )
      )
    `)
    .eq("enrollments.school_id", schoolId)
    .order("full_name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createGuardian(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const fullName = formData.get("fullName") as string
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string | null
  const address = formData.get("address") as string | null

  if (!fullName || !phone) return { error: "Nom et téléphone sont requis." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("guardians").insert({
    full_name: fullName,
    phone,
    email: email || null,
    address: address || null,
  })

  if (error) {
    if (error.code === "23505") return { error: "Ce numéro de téléphone est déjà enregistré." }
    return { error: error.message }
  }

  revalidatePath("/dashboard/direction/admissions")
  return {}
}

// ============================================ ÉLÈVES ==========================

export async function getStudents(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("students")
    .select(`
      *,
      enrollments (
        class_id,
        grade_level_id,
        academic_year_id,
        grade_levels ( name ),
        classes ( name )
      )
    `)
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createStudent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const { data: roleData } = await (await createClient()).auth.getUser()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: schoolData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!schoolData?.school_id) return { error: "Aucune école rattachée" }

  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const dateOfBirth = formData.get("dateOfBirth") as string
  const birthCertificateNumber = formData.get("birthCertificateNumber") as string | null
  const gender = formData.get("gender") as string | null
  const address = formData.get("address") as string | null

  if (!firstName || !lastName || !dateOfBirth) {
    return { error: "Prénom, nom et date de naissance sont requis." }
  }

  const { error } = await admin.from("students").insert({
    school_id: schoolData.school_id,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    birth_certificate_number: birthCertificateNumber || null,
    gender: gender || null,
    address: address || null,
    status: "active",
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/admissions")
  return {}
}

// ============================================ INSCRIPTIONS ====================

export async function getEnrollments(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("enrollments")
    .select(`
      *,
      students ( first_name, last_name ),
      guardians ( full_name, phone ),
      grade_levels ( name ),
      classes ( name ),
      academic_years ( label )
    `)
    .eq("school_id", schoolId)
    .order("enrollment_date", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createEnrollment(formData: FormData): Promise<ActionResult<{ matricule: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: schoolData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!schoolData?.school_id) return { error: "Aucune école rattachée" }

  const studentId = formData.get("studentId") as string
  const guardianId = formData.get("guardianId") as string
  const gradeLevelId = formData.get("gradeLevelId") as string
  const classId = formData.get("classId") as string | null
  const academicYearId = formData.get("academicYearId") as string
  const financialProfileId = formData.get("financialProfileId") as string | null

  if (!studentId || !guardianId || !gradeLevelId || !academicYearId) {
    return { error: "Champs requis manquants." }
  }

  const matricule = `${schoolData.school_id.slice(0, 4).toUpperCase()}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

  const { error } = await admin.from("enrollments").insert({
    school_id: schoolData.school_id,
    student_id: studentId,
    guardian_id: guardianId,
    grade_level_id: gradeLevelId,
    class_id: classId || null,
    academic_year_id: academicYearId,
    financial_profile_id: financialProfileId || null,
    status: "active",
    matricule,
  })

  if (error) {
    if (error.code === "23505") return { error: "Ce matricule existe déjà." }
    return { error: error.message }
  }

  revalidatePath("/dashboard/direction/admissions")
  return { data: { matricule } }
}

// ============================================ PROFILS FINANCIERS ================

export async function getFinancialProfiles(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé", data: [] }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from("financial_profiles")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function createFinancialProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé" }

  const { data: schoolData } = await supabase
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!schoolData?.school_id) return { error: "Aucune école rattachée" }

  const name = formData.get("name") as string
  const description = formData.get("description") as string | null

  if (!name) return { error: "Nom du profil requis." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("financial_profiles").insert({
    school_id: schoolData.school_id,
    name,
    description: description || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}
