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
import { generateEnrollmentMatricule } from "./enrollment-utils"
import type { ActionResult } from "./_shared"

// ============================================ INSCRIPTIONS ====================

export async function getEnrollments(
  schoolId: string,
  opts?: PageRequestOptions
) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  // Lecture membre actif (utilisée aussi par la caisse), bornée à l'école de
  // session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
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

  // S2 : pagination optionnelle en base (compat : sans `opts`, liste complète
  // pour les appelants filtres/dropdowns) — `.range()` + count exact.
  let query = admin
    .from("enrollments")
    .select(
      `
      *,
      students ( first_name, last_name ),
      guardians ( full_name, phone ),
      grade_levels ( name ),
      classes ( name ),
      academic_years ( label )
    `,
      { count: "exact" }
    )
    .eq("school_id", schoolId)
    .order("enrollment_date", { ascending: false })

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

export async function createEnrollment(formData: FormData): Promise<ActionResult<{ matricule: string }>> {
  const supabase = await createClient()

  const guard = await requireSchoolRole(supabase, { allowedRoles: [...ADMISSIONS_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
