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
import { alertEnrollmentConfirmed } from "@/lib/telegram"
import { generateFeeItemsForEnrollment } from "@/lib/finance-fees"
import {
  generateEnrollmentMatricule,
  isPaymentMethod,
  mapSchoolPaymentType,
  parseIdList,
  pickFeeAmount,
  type PaymentMethod,
} from "./enrollment-utils"

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

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================ PRÉ-INSCRIPTIONS (PUBLIC) =====

export async function createPreEnrollment(formData: FormData): Promise<ActionResult<{ code: string }>> {
  const schoolId = formData.get("schoolId") as string
  const firstName = (formData.get("firstName") as string)?.trim()
  const lastName = (formData.get("lastName") as string)?.trim()
  const dateOfBirth = formData.get("dateOfBirth") as string
  const gradeLevelId = formData.get("gradeLevelId") as string
  const guardianPhone = (formData.get("guardianPhone") as string)?.trim()
  const guardianName = ((formData.get("guardianName") as string) || "").trim() || null
  const birthCertificateNumber = ((formData.get("birthCertificateNumber") as string) || "").trim() || null
  const guardianRelation = ((formData.get("guardianRelation") as string) || "").trim()
  const emergencyContactName = ((formData.get("emergencyContactName") as string) || "").trim()
  const emergencyContactPhone = ((formData.get("emergencyContactPhone") as string) || "").trim()
  const previousSchool = ((formData.get("previousSchool") as string) || "").trim()
  const previousClass = ((formData.get("previousClass") as string) || "").trim()
  const enrollmentType = ((formData.get("enrollmentType") as string) || "").trim()
  const stateOrientation = ((formData.get("stateOrientation") as string) || "").trim()
  const orientationNumber = ((formData.get("orientationNumber") as string) || "").trim() || null
  const previousMatricule = ((formData.get("previousMatricule") as string) || "").trim() || null
  const paymentMethodId = (formData.get("paymentMethodId") as string) || null
  const paymentReference = ((formData.get("paymentReference") as string) || "").trim() || null
  const acceptedChecklist = parseIdList(formData.get("acceptedChecklist") as string | null)
  const providedDocuments = parseIdList(formData.get("providedDocuments") as string | null)

  if (!schoolId || !firstName || !lastName || !dateOfBirth || !guardianPhone || !gradeLevelId) {
    return { error: "Tous les champs sont requis." }
  }
  if (!guardianRelation) {
    return { error: "Le lien avec l'élève est requis." }
  }
  if (!emergencyContactName || !emergencyContactPhone) {
    return { error: "Le contact d'urgence (nom et téléphone) est requis." }
  }
  // L'élève peut être en première scolarisation (rien à déclarer) ou venir
  // d'un autre établissement — dans ce cas, école ET dernière classe ensemble.
  if ((previousSchool && !previousClass) || (!previousSchool && previousClass)) {
    return { error: "L'école précédente et la dernière classe fréquentée vont ensemble." }
  }
  if (!enrollmentType || !stateOrientation) {
    return { error: "Le type d'inscription et l'orientation sont requis." }
  }

  const admin = adminClient()

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

  let paymentMethod: PaymentMethod | null = null
  if (paymentMethodId) {
    const { data: method } = await admin
      .from("school_payment_methods")
      .select("id, type")
      .eq("id", paymentMethodId)
      .eq("school_id", schoolId)
      .eq("actif", true)
      .is("deleted_at", null)
      .maybeSingle()
    paymentMethod = mapSchoolPaymentType(method?.type ?? null)
    if (!paymentMethod) return { error: "Moyen de paiement introuvable pour cet etablissement." }
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
    guardian_name: guardianName,
    guardian_relation: guardianRelation,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    previous_school: previousSchool || null,
    previous_class: previousClass || null,
    enrollment_type: enrollmentType,
    state_orientation: stateOrientation,
    orientation_number: orientationNumber,
    previous_matricule: previousMatricule,
    birth_certificate_number: birthCertificateNumber,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    accepted_checklist: acceptedChecklist,
    provided_documents: providedDocuments,
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

type EnrollmentQuote = {
  amount: number
  academicYearId: string
  academicYearLabel: string | null
}

export type CounterEnrollmentResult = {
  matricule: string
  receiptNumber?: string
  verificationCode?: string
  qrCode: string
  amountCollected: number
}

type AdminClient = ReturnType<typeof adminClient>

async function getCurrentAcademicYear(schoolId: string) {
  const admin = adminClient()
  const { data } = await admin
    .from("academic_years")
    .select("id, label")
    .eq("school_id", schoolId)
    .eq("status", "en_cours")
    .maybeSingle()
  return data
}

async function quoteEnrollmentFees(
  admin: AdminClient,
  schoolId: string,
  gradeLevelId: string,
  academicYearId: string,
  financialProfileId?: string | null
): Promise<number> {
  const { data } = await admin
    .from("fee_schedules")
    .select("grade_level_id, academic_year_id, financial_profile_id, amount")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)

  return pickFeeAmount(data ?? [], gradeLevelId, academicYearId, financialProfileId)
}

async function ensureGuardian(
  admin: AdminClient,
  phone: string,
  fullName: string
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await admin
    .from("guardians")
    .select("id")
    .eq("phone", phone)
    .maybeSingle()

  if (existing?.id) return { id: existing.id }

  const { data: created, error } = await admin
    .from("guardians")
    .insert({ phone, full_name: fullName })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { id: created.id }
}

async function issueQrCode(
  admin: AdminClient,
  schoolId: string,
  enrollmentId: string
): Promise<string> {
  const qrCode = crypto.randomBytes(16).toString("hex")
  const { error } = await admin.from("student_qr_codes").insert({
    school_id: schoolId,
    enrollment_id: enrollmentId,
    qr_code: qrCode,
    is_active: true,
  })
  if (error && error.code !== "23505") {
    console.error("[admissions] QR insert failed:", error.message)
  }
  return qrCode
}

async function collectPayment(opts: {
  admin: AdminClient
  schoolId: string
  userId: string
  enrollmentId: string
  amount: number
  paymentMethod: PaymentMethod
  reference: string | null
}): Promise<ActionResult<{ receiptNumber: string; verificationCode: string }>> {
  const { data: payment, error: paymentError } = await opts.admin
    .from("payments")
    .insert({
      school_id: opts.schoolId,
      enrollment_id: opts.enrollmentId,
      amount: opts.amount,
      payment_method: opts.paymentMethod,
      reference: opts.reference,
      received_by: opts.userId,
    })
    .select("id")
    .single()

  if (paymentError) return { error: paymentError.message }

  const verificationCode = crypto.randomBytes(16).toString("hex").toUpperCase()
  const receiptNumber = `R-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const qrCodeData = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify/${verificationCode}`

  const { error: receiptError } = await opts.admin.from("receipts").insert({
    school_id: opts.schoolId,
    payment_id: payment.id,
    receipt_number: receiptNumber,
    verification_code: verificationCode,
    qr_code_data: qrCodeData,
    issued_by: opts.userId,
  })

  if (receiptError) return { error: receiptError.message }
  return { data: { receiptNumber, verificationCode } }
}

async function notifyEnrollment(schoolId: string, studentName: string, amount: number) {
  const admin = adminClient()
  const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle()
  await alertEnrollmentConfirmed({
    schoolName: school?.name ?? "Etablissement",
    studentName,
    amount,
  })
}

export async function getEnrollmentQuote(gradeLevelId: string): Promise<ActionResult<EnrollmentQuote>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }
  if (!gradeLevelId) return { error: "Niveau scolaire requis." }

  const admin = adminClient()
  const { data: gradeLevel } = await admin
    .from("grade_levels")
    .select("id")
    .eq("id", gradeLevelId)
    .eq("school_id", guard.context.schoolId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!gradeLevel) return { error: "Niveau scolaire introuvable pour cet etablissement." }

  const academicYear = await getCurrentAcademicYear(guard.context.schoolId)
  if (!academicYear?.id) {
    return { error: "Aucune annee academique en cours." }
  }

  const amount = await quoteEnrollmentFees(admin, guard.context.schoolId, gradeLevelId, academicYear.id)
  return {
    data: {
      amount,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label ?? null,
    },
  }
}

export async function validatePreEnrollment(
  formData: FormData
): Promise<ActionResult<CounterEnrollmentResult>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const preEnrollmentId = (formData.get("preEnrollmentId") || formData.get("id")) as string
  if (!preEnrollmentId) return { error: "Pre-inscription introuvable." }

  const collectNow = formData.get("collectPayment") === "1"
  const amountRaw = parseInt((formData.get("amount") as string) || "0", 10)
  const paymentMethodRaw = (formData.get("paymentMethod") as string) || ""
  const paymentReference = ((formData.get("paymentReference") as string) || "").trim() || null
  const classId = ((formData.get("classId") as string) || "").trim() || null

  const admin = adminClient()
  const { data: preEnrollment } = await admin
    .from("pre_enrollments")
    .select("*")
    .eq("id", preEnrollmentId)
    .maybeSingle()

  if (!preEnrollment) return { error: "Pre-inscription introuvable." }
  if (preEnrollment.status !== "pending") return { error: "Cette pre-inscription a deja ete traitee." }
  if (new Date(preEnrollment.expires_at) < new Date()) return { error: "Cette pre-inscription a expire." }
  if (guard.context.schoolId !== preEnrollment.school_id) return { error: "Acces non autorise." }
  if (!preEnrollment.grade_level_id) return { error: "Niveau scolaire manquant sur la pre-inscription." }

  const { data: gradeLevel } = await admin
    .from("grade_levels")
    .select("id")
    .eq("id", preEnrollment.grade_level_id)
    .eq("school_id", preEnrollment.school_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!gradeLevel) return { error: "Niveau scolaire introuvable pour cet etablissement." }

  const academicYear = await getCurrentAcademicYear(preEnrollment.school_id)
  if (!academicYear?.id) {
    return { error: "Aucune annee academique en cours. Impossible de valider l'inscription." }
  }

  let paymentMethod: PaymentMethod | null = null
  if (collectNow) {
    if (!isPaymentMethod(paymentMethodRaw)) return { error: "Mode de paiement invalide." }
    if (!Number.isInteger(amountRaw) || amountRaw <= 0) {
      return { error: "Le montant encaisse doit etre un entier positif (FCFA)." }
    }
    paymentMethod = paymentMethodRaw
  }

  // Réinscription : retrouver l'élève existant via son matricule (facultatif,
  // stocké sur la pré-inscription) pour réinscrire SANS créer de doublon de
  // fiche. Le matricule d'État est stable d'une année à l'autre
  // (cf. 20260917040000). Matricule inconnu ou mal tapé → fallback : création
  // d'une nouvelle fiche, comme avant.
  let studentId: string = crypto.randomUUID()
  let matricule = generateEnrollmentMatricule(preEnrollment.school_id)
  let isReEnrolled = false
  const previousMatriculeOnPre = (preEnrollment.previous_matricule as string | null) ?? null
  if ((preEnrollment.enrollment_type as string | null) === "reinscription" && previousMatriculeOnPre) {
    const { data: existing } = await admin
      .from("enrollments")
      .select("student_id, matricule")
      .eq("school_id", preEnrollment.school_id)
      .eq("matricule", previousMatriculeOnPre)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing?.student_id) {
      studentId = existing.student_id as string
      matricule = (existing.matricule as string) || matricule
      isReEnrolled = true
    }
  }

  const guardianName =
    ((formData.get("guardianName") as string) || "").trim() ||
    (preEnrollment.guardian_name as string | null)?.trim() ||
    `Tuteur de ${preEnrollment.last_name} ${preEnrollment.first_name}`

  // Fiche élève : créée pour un nouveau venu ; pour une réinscription
  // retrouvée, la fiche existante est réutilisée (pas de doublon).
  if (!isReEnrolled) {
    const { error: studentError } = await admin.from("students").insert({
      id: studentId,
      school_id: preEnrollment.school_id,
      first_name: preEnrollment.first_name,
      last_name: preEnrollment.last_name,
      date_of_birth: preEnrollment.date_of_birth,
      birth_certificate_number: preEnrollment.birth_certificate_number || null,
      previous_school: (preEnrollment.previous_school as string | null) || null,
      previous_class: (preEnrollment.previous_class as string | null) || null,
      status: "active",
    })
    if (studentError) return { error: studentError.message }
  }

  const guardian = await ensureGuardian(admin, preEnrollment.guardian_phone, guardianName)
  if ("error" in guardian) {
    if (!isReEnrolled) {
      await admin
        .from("students")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", studentId)
    }
    return { error: guardian.error }
  }

  // Transport des informations saisies lors de la pré-inscription (lien avec
  // l'élève, contact d'urgence) vers la fiche tuteur — les dernières
  // informations gagnent. Rien n'est écrasé pour les anciennes pré-inscriptions
  // qui ne portaient pas ces informations.
  const relation = (preEnrollment.guardian_relation as string | null) ?? null
  const emergencyName = (preEnrollment.emergency_contact_name as string | null) ?? null
  const emergencyPhone = (preEnrollment.emergency_contact_phone as string | null) ?? null
  if (relation || emergencyName || emergencyPhone) {
    await admin
      .from("guardians")
      .update({
        relation,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      })
      .eq("id", guardian.id)
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .insert({
      school_id: preEnrollment.school_id,
      student_id: studentId,
      guardian_id: guardian.id,
      grade_level_id: preEnrollment.grade_level_id,
      class_id: classId,
      academic_year_id: academicYear.id,
      status: "confirmed",
      matricule,
      enrollment_type: (preEnrollment.enrollment_type as string | null) ?? null,
      state_orientation: (preEnrollment.state_orientation as string | null) ?? null,
      orientation_number: (preEnrollment.orientation_number as string | null) ?? null,
    })
    .select("id")
    .single()

  if (enrollmentError || !enrollment) {
    if (!isReEnrolled) {
      await admin
        .from("students")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", studentId)
    }
    return { error: enrollmentError?.message ?? "Impossible de creer l'inscription." }
  }

  const qrCode = await issueQrCode(admin, preEnrollment.school_id, enrollment.id)

  // Échéancier : best effort — si la grille n'a pas de tarif pour ce niveau,
  // la direction rattrape via « Générer les échéanciers manquants » (finance).
  await generateFeeItemsForEnrollment(admin, {
    schoolId: preEnrollment.school_id,
    enrollmentId: enrollment.id,
    academicYearId: academicYear.id,
    gradeLevelId: preEnrollment.grade_level_id,
    financialProfileId: null,
  })

  let receipt: { receiptNumber: string; verificationCode: string } | undefined
  if (collectNow && paymentMethod) {
    const paid = await collectPayment({
      admin,
      schoolId: preEnrollment.school_id,
      userId: guard.context.userId,
      enrollmentId: enrollment.id,
      amount: amountRaw,
      paymentMethod,
      reference: paymentReference || preEnrollment.payment_reference || null,
    })
    if (paid.error) {
      await admin.from("pre_enrollments").update({
        status: "validated",
        validated_at: new Date().toISOString(),
      }).eq("id", preEnrollmentId)
      revalidatePath("/dashboard/direction/admissions")
      return {
        error: `Inscription creee (matricule ${matricule}) mais encaissement refuse : ${paid.error}`,
      }
    }
    receipt = paid.data
  }

  await admin
    .from("pre_enrollments")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", preEnrollmentId)

  const studentName = `${preEnrollment.last_name} ${preEnrollment.first_name}`
  await notifyEnrollment(preEnrollment.school_id, studentName, collectNow ? amountRaw : 0)

  revalidatePath("/dashboard/direction/admissions")
  revalidatePath("/dashboard/caisse")
  return {
    data: {
      matricule,
      qrCode,
      amountCollected: collectNow ? amountRaw : 0,
      receiptNumber: receipt?.receiptNumber,
      verificationCode: receipt?.verificationCode,
    },
  }
}

export async function completeCounterEnrollment(
  formData: FormData
): Promise<ActionResult<CounterEnrollmentResult>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const firstName = ((formData.get("firstName") as string) || "").trim()
  const lastName = ((formData.get("lastName") as string) || "").trim()
  const dateOfBirth = formData.get("dateOfBirth") as string
  const gradeLevelId = formData.get("gradeLevelId") as string
  const classId = ((formData.get("classId") as string) || "").trim() || null
  const guardianPhone = ((formData.get("guardianPhone") as string) || "").trim()
  const guardianName = ((formData.get("guardianName") as string) || "").trim()
  const birthCertificateNumber = ((formData.get("birthCertificateNumber") as string) || "").trim() || null
  const amountRaw = parseInt((formData.get("amount") as string) || "0", 10)
  const paymentMethodRaw = (formData.get("paymentMethod") as string) || ""
  const paymentReference = ((formData.get("paymentReference") as string) || "").trim() || null
  const collectNow = formData.get("collectPayment") !== "0"

  if (!firstName || !lastName || !dateOfBirth || !gradeLevelId || !guardianPhone || !guardianName) {
    return { error: "Identite eleve, tuteur et niveau sont requis." }
  }
  if (collectNow) {
    if (!isPaymentMethod(paymentMethodRaw)) return { error: "Mode de paiement invalide." }
    if (!Number.isInteger(amountRaw) || amountRaw <= 0) {
      return { error: "Le montant encaisse doit etre un entier positif (FCFA)." }
    }
  }

  const admin = adminClient()
  const { data: gradeLevel } = await admin
    .from("grade_levels")
    .select("id")
    .eq("id", gradeLevelId)
    .eq("school_id", guard.context.schoolId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!gradeLevel) return { error: "Niveau scolaire introuvable pour cet etablissement." }

  const academicYear = await getCurrentAcademicYear(guard.context.schoolId)
  if (!academicYear?.id) {
    return { error: "Aucune annee academique en cours. Impossible de valider l'inscription." }
  }

  const studentId = crypto.randomUUID()
  const matricule = generateEnrollmentMatricule(guard.context.schoolId)

  const { error: studentError } = await admin.from("students").insert({
    id: studentId,
    school_id: guard.context.schoolId,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    birth_certificate_number: birthCertificateNumber,
    status: "active",
  })
  if (studentError) return { error: studentError.message }

  const guardian = await ensureGuardian(admin, guardianPhone, guardianName)
  if ("error" in guardian) {
    await admin.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", studentId)
    return { error: guardian.error }
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .insert({
      school_id: guard.context.schoolId,
      student_id: studentId,
      guardian_id: guardian.id,
      grade_level_id: gradeLevelId,
      class_id: classId,
      academic_year_id: academicYear.id,
      status: "confirmed",
      matricule,
    })
    .select("id")
    .single()

  if (enrollmentError || !enrollment) {
    await admin.from("students").update({ deleted_at: new Date().toISOString() }).eq("id", studentId)
    return { error: enrollmentError?.message ?? "Impossible de creer l'inscription." }
  }

  const qrCode = await issueQrCode(admin, guard.context.schoolId, enrollment.id)

  // Échéancier : best effort — grille vide tolérée (rattrapage côté finance).
  await generateFeeItemsForEnrollment(admin, {
    schoolId: guard.context.schoolId,
    enrollmentId: enrollment.id,
    academicYearId: academicYear.id,
    gradeLevelId,
    financialProfileId: null,
  })

  let receipt: { receiptNumber: string; verificationCode: string } | undefined
  if (collectNow && isPaymentMethod(paymentMethodRaw)) {
    const paid = await collectPayment({
      admin,
      schoolId: guard.context.schoolId,
      userId: guard.context.userId,
      enrollmentId: enrollment.id,
      amount: amountRaw,
      paymentMethod: paymentMethodRaw,
      reference: paymentReference,
    })
    if (paid.error) {
      revalidatePath("/dashboard/direction/admissions")
      return {
        error: `Inscription creee (matricule ${matricule}) mais encaissement refuse : ${paid.error}`,
      }
    }
    receipt = paid.data
  }

  await notifyEnrollment(guard.context.schoolId, `${lastName} ${firstName}`, collectNow ? amountRaw : 0)

  revalidatePath("/dashboard/direction/admissions")
  revalidatePath("/dashboard/caisse")
  return {
    data: {
      matricule,
      qrCode,
      amountCollected: collectNow ? amountRaw : 0,
      receiptNumber: receipt?.receiptNumber,
      verificationCode: receipt?.verificationCode,
    },
  }
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

  const matricule = generateEnrollmentMatricule(guard.context.schoolId)

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
