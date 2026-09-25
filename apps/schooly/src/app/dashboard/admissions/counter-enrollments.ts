"use server"

import crypto from "crypto"
import { createClient } from "@/utils/supabase/server"
import { ADMISSIONS_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath, updateTag } from "next/cache"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import { generateFeeItemsForEnrollment } from "@/lib/finance-fees"
import { parseForm } from "@/lib/schemas/parse-form"
import { counterEnrollmentSchema, preEnrollmentValidateSchema } from "@/lib/schemas/admissions"
import {
  DIRECTION_DASHBOARD_CACHE_TAG,
  PAYMENTS_CACHE_TAG,
  PRE_ENROLLMENTS_CACHE_TAG,
} from "@/lib/cache-tags"
import { logServerEvent } from "@/lib/server-logger"
import { generateEnrollmentMatricule, mapSchoolPaymentType } from "./enrollment-utils"
import {
  adminClient,
  collectPayment,
  ensureGuardian,
  getCurrentAcademicYear,
  issueQrCode,
  notifyEnrollment,
  quoteEnrollmentFees,
  type ActionResult,
  type CounterEnrollmentResult,
  type EnrollmentQuote,
} from "./_shared"

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

  // Alias historique : certains formulaires envoient « id » au lieu du nom long.
  if (!formData.get("preEnrollmentId") && formData.get("id")) {
    formData.set("preEnrollmentId", String(formData.get("id")))
  }
  const parsed = parseForm(preEnrollmentValidateSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const {
    preEnrollmentId,
    classId,
    collectPayment: collectNow,
    paymentMethod,
    paymentReference,
  } = parsed.data
  // Garanti par le schéma quand collectNow — le fallback 0 reste verrouillé
  // par record_payment (INVALID_AMOUNT) en défense en profondeur.
  const amountRaw = collectNow ? parsed.data.amount ?? 0 : 0

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
      updateTag(PRE_ENROLLMENTS_CACHE_TAG)
      logServerEvent("warn", "enrollment.payment_failed", {
        preEnrollmentId,
        matricule,
        reason: paid.error,
      })
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

  logServerEvent("info", "enrollment.validated", {
    schoolId: preEnrollment.school_id,
    preEnrollmentId,
    matricule,
    amountCollected: collectNow ? amountRaw : 0,
  })

  revalidatePath("/dashboard/direction/admissions")
  revalidatePath("/dashboard/caisse")
  // P1-B : purges immédiates des caches de lectures (Data Cache).
  updateTag(PRE_ENROLLMENTS_CACHE_TAG)
  updateTag(PAYMENTS_CACHE_TAG)
  updateTag(DIRECTION_DASHBOARD_CACHE_TAG)
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

  // Alias historique : « collectPayment » absent du form = encaisser (défaut).
  if (!formData.has("collectPayment")) formData.set("collectPayment", "1")
  const parsed = parseForm(counterEnrollmentSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const {
    firstName,
    lastName,
    dateOfBirth,
    gradeLevelId,
    classId,
    guardianPhone,
    guardianName,
    birthCertificateNumber,
    collectPayment: collectNow,
    paymentMethod,
    paymentReference,
  } = parsed.data
  const amountRaw = collectNow ? parsed.data.amount ?? 0 : 0

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
  if (collectNow && paymentMethod) {
    const paid = await collectPayment({
      admin,
      schoolId: guard.context.schoolId,
      userId: guard.context.userId,
      enrollmentId: enrollment.id,
      amount: amountRaw,
      paymentMethod,
      reference: paymentReference,
    })
    if (paid.error) {
      revalidatePath("/dashboard/direction/admissions")
      updateTag(PRE_ENROLLMENTS_CACHE_TAG)
      logServerEvent("warn", "enrollment.payment_failed", {
        schoolId: guard.context.schoolId,
        matricule,
        reason: paid.error,
      })
      return {
        error: `Inscription creee (matricule ${matricule}) mais encaissement refuse : ${paid.error}`,
      }
    }
    receipt = paid.data
  }

  await notifyEnrollment(guard.context.schoolId, `${lastName} ${firstName}`, collectNow ? amountRaw : 0)

  logServerEvent("info", "enrollment.counter_completed", {
    schoolId: guard.context.schoolId,
    matricule,
    amountCollected: collectNow ? amountRaw : 0,
  })

  revalidatePath("/dashboard/direction/admissions")
  revalidatePath("/dashboard/caisse")
  // P1-B : purges immédiates des caches de lectures (Data Cache).
  updateTag(PRE_ENROLLMENTS_CACHE_TAG)
  updateTag(PAYMENTS_CACHE_TAG)
  updateTag(DIRECTION_DASHBOARD_CACHE_TAG)
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
