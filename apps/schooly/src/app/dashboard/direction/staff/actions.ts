"use server"

import { createClient } from "@/utils/supabase/server"
import { DECISION_ROLES } from "@/utils/supabase/roles"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"

export type ActionResult<T = void> = {
  error?: string
  data?: T
}

export const STAFF_ROLE_CODES = [
  "direction",
  "secretariat",
  "compta",
  "caisse",
  "professeur",
  "surveillance",
] as const

export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number]

export const STAFF_ROLE_LABELS: Record<StaffRoleCode, string> = {
  direction: "Direction",
  secretariat: "Secrétariat",
  compta: "Comptabilité",
  caisse: "Caisse",
  professeur: "Enseignant",
  surveillance: "Surveillance",
}

export type StaffMember = {
  id: string
  user_id: string
  role_code: StaffRoleCode
  is_active: boolean
  created_at: string
  full_name: string
  email: string | null
  phone: string | null
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isStaffRole(value: string): value is StaffRoleCode {
  return (STAFF_ROLE_CODES as readonly string[]).includes(value)
}

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function getStaffMembers(): Promise<ActionResult<StaffMember[]>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...DECISION_ROLES] })
  if (!guard.ok) return denial(guard.reason, [])

  const { data, error } = await adminClient()
    .from("user_school_roles")
    .select("id, user_id, role_code, is_active, created_at, users ( full_name, email, phone )")
    .eq("school_id", guard.context.schoolId)
    .in("role_code", [...STAFF_ROLE_CODES])
    .order("created_at", { ascending: true })

  if (error) return { error: error.message, data: [] }

  const members: StaffMember[] = (data ?? []).map((row) => {
    const profile = Array.isArray(row.users) ? row.users[0] : row.users
    return {
      id: row.id,
      user_id: row.user_id,
      role_code: isStaffRole(row.role_code) ? row.role_code : "professeur",
      is_active: row.is_active,
      created_at: row.created_at,
      full_name: profile?.full_name ?? "Sans nom",
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
    }
  })

  return { data: members }
}

export async function inviteStaffMember(
  formData: FormData,
): Promise<ActionResult<{ email: string; password: string; created: boolean }>> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...DECISION_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const fullName = ((formData.get("fullName") as string) || "").trim()
  const email = ((formData.get("email") as string) || "").trim().toLowerCase()
  const roleCode = ((formData.get("roleCode") as string) || "").trim()
  const providedPassword = ((formData.get("password") as string) || "").trim()

  if (!fullName || !email) return { error: "Nom et email sont requis." }
  if (!email.includes("@")) return { error: "Email invalide." }
  if (!isStaffRole(roleCode)) return { error: "Rôle invalide." }

  const password = providedPassword.length >= 8 ? providedPassword : generatePassword()
  const admin = adminClient()

  const { data: existingProfile } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle()

  let userId = existingProfile?.id ?? null
  let created = false

  if (!userId) {
    const { data: createdUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (authError || !createdUser.user) {
      return { error: authError?.message || "Impossible de créer le compte." }
    }
    userId = createdUser.user.id
    created = true
    await admin.from("users").update({ full_name: fullName, email }).eq("id", userId)
  }

  const { data: existingRole } = await admin
    .from("user_school_roles")
    .select("id")
    .eq("school_id", guard.context.schoolId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingRole) {
    return { error: "Cette personne fait déjà partie du personnel de l'établissement." }
  }

  const { error: roleError } = await admin.from("user_school_roles").insert({
    user_id: userId,
    school_id: guard.context.schoolId,
    role_code: roleCode,
    is_active: true,
  })
  if (roleError) return { error: roleError.message }

  revalidatePath("/dashboard/direction/staff")
  return { data: { email, password: created ? password : "", created } }
}

async function countActiveDirectors(schoolId: string, exceptUserId?: string): Promise<number> {
  let query = adminClient()
    .from("user_school_roles")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role_code", "direction")
    .eq("is_active", true)
  if (exceptUserId) query = query.neq("user_id", exceptUserId)
  const { count } = await query
  return count ?? 0
}

export async function updateStaffRole(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...DECISION_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const membershipId = ((formData.get("membershipId") as string) || "").trim()
  const roleCode = ((formData.get("roleCode") as string) || "").trim()
  if (!membershipId) return { error: "Membre introuvable." }
  if (!isStaffRole(roleCode)) return { error: "Rôle invalide." }

  const admin = adminClient()
  const { data: membership } = await admin
    .from("user_school_roles")
    .select("id, user_id, role_code, is_active")
    .eq("id", membershipId)
    .eq("school_id", guard.context.schoolId)
    .maybeSingle()

  if (!membership) return { error: "Membre introuvable dans cet établissement." }

  if (membership.role_code === "direction" && roleCode !== "direction" && membership.is_active) {
    const remaining = await countActiveDirectors(guard.context.schoolId, membership.user_id)
    if (remaining < 1) {
      return { error: "Impossible de retirer le dernier compte direction." }
    }
  }

  const { error } = await admin
    .from("user_school_roles")
    .update({ role_code: roleCode })
    .eq("id", membership.id)
    .eq("school_id", guard.context.schoolId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/direction/staff")
  return {}
}

export async function setStaffActive(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...DECISION_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, null).error }

  const membershipId = ((formData.get("membershipId") as string) || "").trim()
  const nextActive = ((formData.get("isActive") as string) || "") === "true"
  if (!membershipId) return { error: "Membre introuvable." }

  const admin = adminClient()
  const { data: membership } = await admin
    .from("user_school_roles")
    .select("id, user_id, role_code, is_active")
    .eq("id", membershipId)
    .eq("school_id", guard.context.schoolId)
    .maybeSingle()

  if (!membership) return { error: "Membre introuvable dans cet établissement." }
  if (membership.user_id === guard.context.userId && !nextActive) {
    return { error: "Vous ne pouvez pas désactiver votre propre accès." }
  }
  if (membership.role_code === "direction" && membership.is_active && !nextActive) {
    const remaining = await countActiveDirectors(guard.context.schoolId, membership.user_id)
    if (remaining < 1) {
      return { error: "Impossible de désactiver le dernier compte direction." }
    }
  }

  const { error } = await admin
    .from("user_school_roles")
    .update({ is_active: nextActive })
    .eq("id", membership.id)
    .eq("school_id", guard.context.schoolId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/direction/staff")
  return {}
}
