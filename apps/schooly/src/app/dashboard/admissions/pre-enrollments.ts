"use server"

import { createClient } from "@/utils/supabase/server"
import { ADMISSIONS_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath, unstable_cache, updateTag } from "next/cache"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import { parseForm } from "@/lib/schemas/parse-form"
import { preEnrollmentPublicSchema } from "@/lib/schemas/admissions"
import {
  PRE_ENROLLMENTS_CACHE_TAG,
  READ_CACHE_TTL_SECONDS,
} from "@/lib/cache-tags"
import {
  buildPageResult,
  pageRange,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
import { mapSchoolPaymentType, parseIdList, type PaymentMethod } from "./enrollment-utils"
import { adminClient, generateCode, type ActionResult } from "./_shared"

// ============================================ PRÉ-INSCRIPTIONS (PUBLIC) =====

export async function createPreEnrollment(formData: FormData): Promise<ActionResult<{ code: string }>> {
  // P1-A : contrat zod du tunnel public — les règles historiques (champs
  // requis, contact d'urgence, paire école/classe précédente) vivent dans le
  // schéma ; les valeurs incohérentes sont refusées avant tout SQL.
  const parsed = parseForm(preEnrollmentPublicSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const {
    schoolId,
    firstName,
    lastName,
    dateOfBirth,
    gradeLevelId,
    guardianPhone,
    guardianName,
    birthCertificateNumber,
    guardianRelation,
    emergencyContactName,
    emergencyContactPhone,
    previousSchool,
    previousClass,
    enrollmentType,
    stateOrientation,
    orientationNumber,
    previousMatricule,
    paymentMethodId,
    paymentReference,
  } = parsed.data
  const acceptedChecklist = parseIdList(formData.get("acceptedChecklist") as string | null)
  const providedDocuments = parseIdList(formData.get("providedDocuments") as string | null)

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

  if (error) {
    if (error.code === "23505" || error.message.includes("uq_pre_enrollments_school_code")) {
      return { error: "Code déjà utilisé — réessayez." }
    }
    return { error: error.message }
  }

  revalidatePath(`/enroll/${schoolId}`)
  updateTag(PRE_ENROLLMENTS_CACHE_TAG)
  return { data: { code } }
}

export async function getPreEnrollments(
  schoolId: string,
  opts?: PageRequestOptions
) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  // Candidatures (données personnelles d'un mineur) : direction/secretariat.
  const guard = await requireSchoolRole(supabase, {
    allowedRoles: [...ADMISSIONS_ROLES],
    requestedSchoolId: schoolId,
  })
  if (!guard.ok) {
    // Contrat uniforme : même en cas de refus, les métadonnées de page sont là.
    return {
      error: denial(guard.reason, []).error,
      ...buildPageResult([], 0, request),
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Pagination optionnelle : sans `opts`, on renvoie la liste complète
  // (compatibilité des appelants filtres/dropdowns), avec `opts` on borne
  // en base via `.range()` et on renvoie les métadonnées de page.
  //
  // P1-B : lecture mise en cache (clé : école + page), purgée par tag à
  // chaque écriture sur les pré-inscriptions (`updateTag`), TTL de sécurité
  // en secours. Le client `admin` reste dans la fermeture (non sérialisable).
  const loadPage = unstable_cache(
    async () => {
      let query = admin
        .from("pre_enrollments")
        .select(
          `
      *,
      grade_levels ( name )
    `,
          { count: "exact" }
        )
        .eq("school_id", guard.context.schoolId)
        .order("created_at", { ascending: false })

      if (request.wantsPagination) {
        const { from, to } = pageRange(request)
        query = query.range(from, to)
      }

      return await query
    },
    [
      "pre-enrollments",
      guard.context.schoolId,
      request.wantsPagination ? `p${request.page}s${request.pageSize}` : "all",
    ],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [PRE_ENROLLMENTS_CACHE_TAG] }
  )

  const { data, error, count } = await loadPage()

  if (error) {
    return { error: error.message, ...buildPageResult([], 0, request) }
  }
  return buildPageResult(data ?? [], count, request)
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
    process.env.SUPABASE_SECRET_KEY!
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
