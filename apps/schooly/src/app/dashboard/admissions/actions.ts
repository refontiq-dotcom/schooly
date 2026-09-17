"use server"

import { createClient } from "@/utils/supabase/server"
import { ADMISSIONS_ROLES, FINANCIAL_PROFILE_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import {
  denial,
  requireSchoolRole,
} from "@/utils/supabase/require-role"

/**
 * Module Admissions — pré-inscriptions, tuteurs, élèves, inscriptions, profils.
 *
 * Sécurisation (audit P1-2) : chaque action est gardée par `requireSchoolRole`.
 * Exception documentée : `createPreEnrollment` est le tunnel PUBLIC
 * (/enroll/[schoolId]) — il ne porte aucune session mais vérifie l'existence
 * de l'école ciblée avant d'écrire. Le `school_id` est TOUJOURS résolu depuis
 * la session pour les membres (anti-injection cross-tenant).
 */

export type ActionResult<T = void> = {
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

  if (!schoolId || !firstName || !lastName || !dateOfBirth || !guardianPhone || !gradeLevelId) {
    return { error: "Tous les champs sont requis." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Tunnel public : le schoolId vient de l'URL. Vérifier que l'école existe
  // (et n'est pas supprimée) avant d'écrire — sinon spam possible sur des
  // identifiants arbitraires.
  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .is("deleted_at", null)
    .single()

  if (!school) return { error: "Établissement introuvable." }

  const { data: gradeLevel } = await admin
    .from("grade_levels")
    .select("id")
    .eq("id", gradeLevelId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!gradeLevel) return { error: "Niveau scolaire introuvable pour cet établissement." }

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
    grade_level_id: gradeLevelId,
    guardian_phone: guardianPhone,
    code,
    status: "pending",
    expires_at: expiresAt.toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/enroll/${schoolId}`)
  return { data: { code } }
}

export async function getPreEnrollments(schoolId: string) {
  const supabase = await createClient()

  // Candidatures (données personnelles d'un mineur) : direction/secretariat.
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...ADMISSIONS_ROLES],
    requestedSchoolId: schoolId,
  })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

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
    .eq("school_id", guard.context.schoolId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

export async function getPreEnrollmentByCode(schoolId: string, code: string) {
  const supabase = await createClient()

  // Sans appelant à ce jour (la page /verify/[code] passe par verifyReceipt).
  // Verrouillé par principe : lecture de données personnelles d'un candidat,
  // réservée aux membres actifs de l'école concernée.
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return null

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

  // Acte d'admission : direction/secretariat uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const preEnrollmentId = (formData.get("preEnrollmentId") || formData.get("id")) as string

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

  if (guard.context.schoolId !== preEnrollment.school_id) {
    return { error: "Accès non autorisé." }
  }

  if (!preEnrollment.grade_level_id) {
    return { error: "Niveau scolaire manquant sur la pré-inscription." }
  }

  const { data: gradeLevel } = await admin
    .from("grade_levels")
    .select("id")
    .eq("id", preEnrollment.grade_level_id)
    .eq("school_id", preEnrollment.school_id)
    .is("deleted_at", null)
    .single()

  if (!gradeLevel) {
    return { error: "Niveau scolaire introuvable pour cet établissement." }
  }

  const academicYear = await getCurrentAcademicYear(preEnrollment.school_id)
  if (!academicYear?.id) {
    return { error: "Aucune année académique en cours. Impossible de valider l'inscription." }
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
    .maybeSingle()

  let guardianId = existingGuardian?.id

  if (!guardianId) {
    const { data: newGuardian, error: guardianError } = await admin
      .from("guardians")
      .insert({
        phone: preEnrollment.guardian_phone,
        full_name: `${preEnrollment.last_name} ${preEnrollment.first_name} (tuteur)`,
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
    academic_year_id: academicYear.id,
    status: "confirmed",
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

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

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

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

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

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

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

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    school_id: guard.context.schoolId,
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

  // Lecture membre actif (utilisée aussi par la caisse), bornée à l'école de
  // session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

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

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const studentId = formData.get("studentId") as string
  const guardianId = formData.get("guardianId") as string
  const gradeLevelId = formData.get("gradeLevelId") as string
  const classId = formData.get("classId") as string | null
  const academicYearId = formData.get("academicYearId") as string
  const financialProfileId = formData.get("financialProfileId") as string | null

  if (!studentId || !guardianId || !gradeLevelId || !academicYearId) {
    return { error: "Champs requis manquants." }
  }

  const matricule = `${guard.context.schoolId.slice(0, 4).toUpperCase()}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

  const { error } = await admin.from("enrollments").insert({
    school_id: guard.context.schoolId,
    student_id: studentId,
    guardian_id: guardianId,
    grade_level_id: gradeLevelId,
    class_id: classId || null,
    academic_year_id: academicYearId,
    financial_profile_id: financialProfileId || null,
    status: "confirmed",
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

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

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

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...FINANCIAL_PROFILE_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const name = formData.get("name") as string
  const description = formData.get("description") as string | null

  if (!name) return { error: "Nom du profil requis." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from("financial_profiles").insert({
    school_id: guard.context.schoolId,
    name,
    description: description || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/finance")
  return {}
}
