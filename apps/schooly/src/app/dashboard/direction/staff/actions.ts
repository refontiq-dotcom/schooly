"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { STRUCTURE_ADMIN_ROLES, ALL_STAFF_ROLES } from "@/utils/supabase/roles"

const STAFF_ROLES = ALL_STAFF_ROLES.filter((r) => r !== "super_admin")

type Result = { error?: string; data?: unknown }

async function context() {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["direction", "super_admin"] })
  if (!guard.ok) return { ok: false as const, error: "Accès réservé à la direction." }
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return { ok: true as const, admin, schoolId: guard.context.schoolId, role: guard.context.role }
}

export async function getStaff(): Promise<Result> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }
  const { data, error } = await ctx.admin
    .from("user_school_roles")
    .select("id, user_id, role_code, is_active, created_at, users!inner(id, full_name, email, phone)")
    .eq("school_id", ctx.schoolId)
    .neq("role_code", "parent")
    .neq("role_code", "eleve")
    .order("created_at", { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function createStaffMember(formData: FormData): Promise<Result> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }

  const fullName = String(formData.get("fullName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const phone = String(formData.get("phone") ?? "").trim() || null
  const roleCode = String(formData.get("roleCode") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!fullName || fullName.length < 2) return { error: "Le nom complet est requis." }
  if (!email || !email.includes("@")) return { error: "Une adresse email professionnelle valide est requise." }
  if (!STAFF_ROLES.includes(roleCode as (typeof STAFF_ROLES)[number])) return { error: "Rôle invalide." }
  if (password.length < 8) return { error: "Le mot de passe initial doit contenir au moins 8 caractères." }

  const { data: existingUser } = await ctx.admin
    .from("users")
    .select("id, full_name")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle()

  let userId = existingUser?.id

  if (userId) {
    const { data: existingRole } = await ctx.admin
      .from("user_school_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("school_id", ctx.schoolId)
      .eq("role_code", roleCode)
      .maybeSingle()
    if (existingRole) return { error: "Cette personne possède déjà ce rôle dans l'établissement." }
  } else {
    const { data: authData, error: authError } = await ctx.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (authError || !authData.user) return { error: authError?.message ?? "Impossible de créer le compte." }
    userId = authData.user.id
  }

  const { error: userError } = await ctx.admin
    .from("users")
    .upsert({ id: userId, full_name: fullName, email, phone }, { onConflict: "id" })
  if (userError) return { error: userError.message }

  const { error: roleError } = await ctx.admin.from("user_school_roles").insert({
    user_id: userId,
    school_id: ctx.schoolId,
    role_code: roleCode,
    is_active: true,
  })
  if (roleError) return { error: roleError.message }

  revalidatePath("/dashboard/direction/staff")
  revalidatePath("/dashboard/academic-structure")
  return { data: { userId, roleCode } }
}

export async function setStaffRoleActive(formData: FormData): Promise<Result> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }

  const roleId = String(formData.get("roleId") ?? "")
  const isActive = String(formData.get("isActive") ?? "") === "true"
  if (!roleId) return { error: "Affectation introuvable." }

  const { data: updated, error } = await ctx.admin
    .from("user_school_roles")
    .update({ is_active: isActive })
    .eq("id", roleId)
    .eq("school_id", ctx.schoolId)
    .select("id")
  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Affectation introuvable dans cet établissement." }

  revalidatePath("/dashboard/direction/staff")
  revalidatePath("/dashboard/academic-structure")
  return {}
}
