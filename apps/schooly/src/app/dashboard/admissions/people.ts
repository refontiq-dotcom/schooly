"use server"

import { createClient } from "@/utils/supabase/server"
import { ADMISSIONS_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import {
  buildPageResult,
  pageRange,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ TUTEURS =========================

/**
 * S2 : `opts` pagine la liste en base. Sans `opts`, la liste complète est
 * renvoyée : les onglets « Tuteurs » de l'annuaire et la construction de la
 * carte de solde ont besoin de l'ensemble, pas d'une page.
 */
export async function getGuardians(schoolId: string, opts?: PageRequestOptions) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) {
    return {
      error: denial(guard.reason, []).error,
      ...buildPageResult([], 0, request),
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = admin
    .from("guardians")
    .select(
      `
      *,
      enrollments (
        student_id,
        students ( first_name, last_name )
      )
    `,
      { count: "exact" }
    )
    .eq("enrollments.school_id", schoolId)
    .order("full_name", { ascending: true })

  if (request.wantsPagination) {
    const { from, to } = pageRange(request)
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) {
    return { error: error.message, ...buildPageResult([], 0, request) }
  }
  return buildPageResult(data || [], count, request)
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
    process.env.SUPABASE_SECRET_KEY!
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

/**
 * Élèves de l'école avec leurs inscriptions (niveau, classe, année).
 * S2 : `opts` pagine en base ; sans `opts`, liste complète (onglets annuaire).
 */
export async function getStudents(schoolId: string, opts?: PageRequestOptions) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) {
    return {
      error: denial(guard.reason, []).error,
      ...buildPageResult([], 0, request),
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = admin
    .from("students")
    .select(
      `
      *,
      enrollments (
        class_id,
        grade_level_id,
        academic_year_id,
        grade_levels ( name ),
        classes ( name )
      )
    `,
      { count: "exact" }
    )
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true })

  if (request.wantsPagination) {
    const { from, to } = pageRange(request)
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) {
    return { error: error.message, ...buildPageResult([], 0, request) }
  }
  return buildPageResult(data || [], count, request)
}

export async function createStudent(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
