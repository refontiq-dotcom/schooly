"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { SCHOOL_TYPE_VALUES } from "./school-types"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

export type SchoolSettings = {
  id: string
  name: string
  city: string | null
  school_type: string | null
  published_to_trouvetou: boolean
  created_at: string
  directorName: string
  directorEmail: string | null
}

type Context = {
  userId: string
  schoolId: string
  roleCode: string
}

async function getContext(): Promise<Context> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("NOT_AUTHENTICATED")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: role } = await admin
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "informatique", "super_admin"])
    .limit(1)
    .maybeSingle()

  if (!role?.school_id) throw new Error("UNAUTHORIZED")

  return { userId: user.id, schoolId: role.school_id, roleCode: role.role_code }
}

export async function getSchoolSettings(): Promise<SchoolSettings> {
  const { userId, schoolId } = await getContext()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: school }, { data: profile }] = await Promise.all([
    admin
      .from("schools")
      .select("id, name, city, school_type, published_to_trouvetou, created_at")
      .eq("id", schoolId)
      .single(),
    admin.from("users").select("full_name, email").eq("id", userId).single(),
  ])

  if (!school) throw new Error("SCHOOL_NOT_FOUND")

  return {
    id: school.id,
    name: school.name,
    city: school.city,
    school_type: school.school_type,
    published_to_trouvetou: school.published_to_trouvetou ?? false,
    created_at: school.created_at,
    directorName: profile?.full_name ?? "",
    directorEmail: profile?.email ?? null,
  }
}

export async function updateSchoolSettings(formData: FormData): Promise<ActionResult> {
  let context: Context
  try {
    context = await getContext()
  } catch (err) {
    return { error: err instanceof Error && err.message === "NOT_AUTHENTICATED" ? "Non autorisé" : "Accès refusé" }
  }

  const name = (formData.get("name") as string | null)?.trim()
  const city = (formData.get("city") as string | null)?.trim()
  const schoolType = (formData.get("schoolType") as string | null)?.trim()

  if (!name) return { error: "Le nom de l'établissement est requis." }

  const validTypes = SCHOOL_TYPE_VALUES
  if (schoolType && !validTypes.includes(schoolType)) {
    return { error: "Type d'établissement invalide." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from("schools")
    .update({
      name,
      city: city || null,
      school_type: schoolType || null,
    })
    .eq("id", context.schoolId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/settings")
  revalidatePath("/dashboard/direction")
  return {}
}

export async function updateDirectorProfile(formData: FormData): Promise<ActionResult> {
  let context: Context
  try {
    context = await getContext()
  } catch (err) {
    return { error: err instanceof Error && err.message === "NOT_AUTHENTICATED" ? "Non autorisé" : "Accès refusé" }
  }

  if (context.roleCode !== "direction" && context.roleCode !== "super_admin") return { error: "Seule la direction peut modifier le profil du directeur." }

  const fullName = (formData.get("fullName") as string | null)?.trim()

  if (!fullName) return { error: "Le nom complet est requis." }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from("users")
    .update({ full_name: fullName })
    .eq("id", context.userId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/direction/settings")
  return {}
}
