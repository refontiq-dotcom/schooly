"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { roleHome } from "@/utils/supabase/route-rules"

export type LoginResult = {
  error: string | null
  success?: boolean
  mode?: "password" | "activation_verify" | "password_setup"
  contact?: string
}

function normalizeContact(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

function isEmail(contact: string) {
  return contact.includes("@")
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type AdminClient = ReturnType<typeof adminClient>

async function findStaffUser(contact: string, admin: AdminClient) {
  const query = admin
    .from("users")
    .select("id, email, phone, full_name, is_activated")
    .is("deleted_at", null)

  return isEmail(contact)
    ? query.eq("email", contact).maybeSingle()
    : query.eq("phone", contact).maybeSingle()
}

async function sendStaffOtp(contact: string) {
  const supabase = await createClient()
  const credentials = isEmail(contact) ? { email: contact } : { phone: contact }

  const { error } = await supabase.auth.signInWithOtp({
    ...credentials,
    options: { shouldCreateUser: false },
  })

  return error
}

async function getActiveStaffRole(
  admin: AdminClient,
  userId: string
) {
  const { data } = await admin
    .from("user_school_roles")
    .select("role_code, school_id, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("role_code", "parent")
    .neq("role_code", "eleve")
    .neq("role_code", "super_admin")
    .order("created_at", { ascending: true })
    .limit(1)

  return data?.[0]
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNEXION ÉCOLE :
// 1. email/téléphone → Schooly détecte le type de compte
// 2. compte actif → demande le mot de passe
// 3. compte invité → OTP puis création du mot de passe personnel
// ═══════════════════════════════════════════════════════════════════════════
export async function schoolLoginAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const contact = normalizeContact(formData.get("contact") ?? formData.get("email"))
  const password = String(formData.get("password") ?? "")

  if (!contact) return { error: "Email professionnel ou numéro de téléphone requis." }

  const admin = adminClient()

  const { data: profile, error: profileError } = await findStaffUser(contact, admin)
  if (profileError) return { error: "Impossible de vérifier ce compte pour le moment." }

  const role = profile?.id ? await getActiveStaffRole(admin, profile.id) : null
  if (!profile || !role) {
    return { error: "Aucun accès établissement actif ne correspond à ce contact." }
  }

  if (!profile.is_activated) {
    if (password) {
      return {
        error: "Ce compte doit d'abord être activé. Demandez un code de vérification.",
        mode: "activation_verify",
        contact,
      }
    }

    const otpError = await sendStaffOtp(contact)
    if (otpError) {
      return { error: "Impossible d'envoyer le code de vérification. Réessayez dans un instant." }
    }

    return { error: null, success: true, mode: "activation_verify", contact }
  }

  if (!password) {
    return { error: null, mode: "password", contact }
  }

  const supabase = await createClient()
  const credentials = isEmail(contact)
    ? { email: contact, password }
    : { phone: contact, password }

  const { data, error } = await supabase.auth.signInWithPassword(credentials)
  if (error || !data.user) {
    return { error: "Identifiants incorrects.", mode: "password", contact }
  }

  const destination = roleHome(role.role_code)
  if (!destination) {
    await supabase.auth.signOut()
    return { error: "Ce compte n'a pas d'espace dans cette application. Contactez votre établissement." }
  }

  redirect(destination)
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATION : vérifier le code reçu par email/SMS
// ═══════════════════════════════════════════════════════════════════════════
export async function schoolActivationVerifyAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const contact = normalizeContact(formData.get("contact"))
  const token = String(formData.get("token") ?? "").trim()

  if (!contact || !token) return { error: "Contact et code de vérification requis." }

  const supabase = await createClient()
  const verification = isEmail(contact)
    ? { email: contact, token, type: "email" as const }
    : { phone: contact, token, type: "sms" as const }

  const { data, error } = await supabase.auth.verifyOtp(verification)
  if (error || !data.user) {
    return { error: "Code invalide ou expiré. Demandez un nouveau code." }
  }

  const admin = adminClient()

  const { data: profile } = await admin
    .from("users")
    .select("id, is_activated")
    .eq("id", data.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  const role = await getActiveStaffRole(admin, data.user.id)

  if (!profile || profile.is_activated || !role) {
    await supabase.auth.signOut()
    return { error: "Ce compte ne nécessite plus d'activation ou n'a plus d'accès établissement." }
  }

  return { error: null, success: true, mode: "password_setup", contact }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATION : l'utilisateur choisit lui-même son mot de passe
// ═══════════════════════════════════════════════════════════════════════════
export async function completeStaffActivationAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." }
  if (password !== confirmPassword) return { error: "Les deux mots de passe ne correspondent pas." }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "Votre vérification a expiré. Recommencez l'activation." }
  }

  const admin = adminClient()

  const { data: profile } = await admin
    .from("users")
    .select("id, is_activated")
    .eq("id", authData.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  const role = await getActiveStaffRole(admin, authData.user.id)

  if (!profile || profile.is_activated || !role) {
    return { error: "Ce compte ne nécessite plus d'activation ou n'a plus d'accès établissement." }
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password })
  if (passwordError) {
    return { error: "Impossible d'enregistrer le mot de passe. Réessayez." }
  }

  const { error: activationError } = await admin
    .from("users")
    .update({ is_activated: true, activated_at: new Date().toISOString() })
    .eq("id", authData.user.id)

  if (activationError) {
    return { error: "Mot de passe enregistré, mais l'activation n'a pas pu être finalisée. Réessayez." }
  }

  const destination = roleHome(role.role_code)
  if (!destination) {
    await supabase.auth.signOut()
    return { error: "Votre rôle n'a pas d'espace Schooly disponible." }
  }

  redirect(destination)
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PARENT (étape 1)
// ═══════════════════════════════════════════════════════════════════════════
export async function parentOtpSendAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string

  if (!email) return { error: "Email requis." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })

  if (error) return { error: "Erreur lors de l'envoi du code. Vérifiez votre email." }
  return { error: null, success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PARENT (étape 2)
// ═══════════════════════════════════════════════════════════════════════════
export async function parentOtpVerifyAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string
  const token = formData.get("token") as string

  if (!email || !token) return { error: "Code de vérification requis." }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })

  if (error) return { error: "Code invalide ou expiré. Veuillez réessayer." }
  redirect("/parent/dashboard")
}
