"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

type LoginResult = { error: string | null; success?: boolean }

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN ÉCOLE : email + mot de passe
// ═══════════════════════════════════════════════════════════════════════════
export async function schoolLoginAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email et mot de passe requis." }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Identifiants incorrects." }
  }

  redirect("/dashboard")
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PARENT (étape 1) : envoyer le code OTP par email
// ═══════════════════════════════════════════════════════════════════════════
export async function parentOtpSendAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string

  if (!email) {
    return { error: "Email requis." }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) {
    return { error: "Erreur lors de l'envoi du code. Vérifiez votre email." }
  }

  return { error: null, success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN PARENT (étape 2) : vérifier le code OTP
// ═══════════════════════════════════════════════════════════════════════════
export async function parentOtpVerifyAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string
  const token = formData.get("token") as string

  if (!email || !token) {
    return { error: "Code de vérification requis." }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })

  if (error) {
    return { error: "Code invalide ou expiré. Veuillez réessayer." }
  }

  redirect("/parent/dashboard")
}
