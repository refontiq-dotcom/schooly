"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { ALL_STAFF_ROLES } from "@/utils/supabase/roles"

const STAFF_ROLES = ALL_STAFF_ROLES

type Result = { error?: string; data?: unknown }

async function context() {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["direction"] })
  if (!guard.ok) return { ok: false as const, error: "Accès réservé à la direction." }
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  return { ok: true as const, admin, schoolId: guard.context.schoolId, role: guard.context.roleCode }
}

async function sendActivationCode(contact: { email?: string; phone?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    ...(contact.email ? { email: contact.email } : { phone: contact.phone! }),
    options: { shouldCreateUser: false },
  })
  return error
}

export async function getStaff(): Promise<Result> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }

  const { data: roles, error: rolesError } = await ctx.admin
    .from("user_school_roles")
    .select("id, user_id, role_code, is_active, created_at")
    .eq("school_id", ctx.schoolId)
    .neq("role_code", "parent")
    .neq("role_code", "eleve")
    .order("created_at", { ascending: true })

  if (rolesError) return { error: rolesError.message }

  const roleRows = roles ?? []
  const userIds = [...new Set(roleRows.map((row) => row.user_id))]

  if (userIds.length === 0) return { data: [] }

  const { data: users, error: usersError } = await ctx.admin
    .from("users")
    .select("id, full_name, email, phone, is_activated, activated_at")
    .in("id", userIds)

  if (usersError) return { error: usersError.message }

  const usersById = new Map((users ?? []).map((user) => [user.id, user]))

  return {
    data: roleRows.map((role) => ({
      ...role,
      users: usersById.get(role.user_id) ?? null,
    })),
  }
}

export async function createStaffMember(formData: FormData): Promise<Result> {
  const ctx = await context()
  if (!ctx.ok) return { error: ctx.error }

  const fullName = String(formData.get("fullName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const roleCode = String(formData.get("roleCode") ?? "").trim()

  if (!fullName || fullName.length < 2) return { error: "Le nom complet est requis." }
  if (!email && !phone) return { error: "Indiquez au moins un email ou un numéro de téléphone." }
  if (email && !email.includes("@")) return { error: "L'adresse email professionnelle est invalide." }
  if (!STAFF_ROLES.includes(roleCode as (typeof STAFF_ROLES)[number])) return { error: "Rôle invalide." }

  const existingQuery = ctx.admin
    .from("users")
    .select("id, full_name, is_activated")
    .is("deleted_at", null)

  const { data: existingUser, error: existingUserError } = email
    ? await existingQuery.eq("email", email).maybeSingle()
    : await existingQuery.eq("phone", phone).maybeSingle()

  if (existingUserError) return { error: existingUserError.message }

  let userId = existingUser?.id
  let createdNewUser = false

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
      ...(email ? { email } : { phone: phone! }),
      user_metadata: { full_name: fullName },
    })

    if (authError || !authData.user) {
      return { error: authError?.message ?? "Impossible de créer le compte." }
    }

    userId = authData.user.id
    createdNewUser = true
  }

  const { error: userError } = await ctx.admin
    .from("users")
    .upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        phone,
        ...(createdNewUser ? { is_activated: false, activated_at: null } : {}),
      },
      { onConflict: "id" }
    )

  if (userError) return { error: userError.message }

  const { error: roleError } = await ctx.admin.from("user_school_roles").insert({
    user_id: userId,
    school_id: ctx.schoolId,
    role_code: roleCode,
    is_active: true,
  })

  if (roleError) return { error: roleError.message }

  if (createdNewUser || existingUser?.is_activated === false) {
    const activationError = await sendActivationCode(email ? { email } : { phone: phone! })
    if (activationError) {
      revalidatePath("/dashboard/direction/staff")
      return {
        error:
          "Accès créé, mais l'invitation n'a pas pu être envoyée (" +
          activationError.message +
          "). Le collaborateur pourra demander un nouveau code depuis la connexion.",
      }
    }
  }

  revalidatePath("/dashboard/direction/staff")
  revalidatePath("/dashboard/academic-structure")

  return {
    data: {
      userId,
      roleCode,
      activationRequired: createdNewUser || existingUser?.is_activated === false,
    },
  }
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

export async function setStaffRoleActiveFormAction(formData: FormData): Promise<void> {
  await setStaffRoleActive(formData)
}
