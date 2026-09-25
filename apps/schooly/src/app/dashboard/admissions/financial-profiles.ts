"use server"

import { createClient } from "@/utils/supabase/server"
import { FINANCIAL_PROFILE_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ PROFILS FINANCIERS ================

export async function getFinancialProfiles(schoolId: string) {
  const supabase = await createClient()

  // Lecture membre actif, bornée à l'école de session (anti-IDOR cross-tenant).
  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) return { error: denial(guard.reason, []).error }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
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
    process.env.SUPABASE_SECRET_KEY!
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
