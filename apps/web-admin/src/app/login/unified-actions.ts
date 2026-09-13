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
// LOGIN PARENT (étape 1) : envoyer le code OTP par email ou SMS
// ═══════════════════════════════════════════════════════════════════════════
export async function parentOtpSendAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const contact = formData.get("contact") as string

  if (!contact) {
    return { error: "Email ou numéro de téléphone requis." }
  }

  const supabase = await createClient()

  // Détecter si c'est un email ou un téléphone
  const isEmail = contact.includes("@")

  if (isEmail) {
    const { error } = await supabase.auth.signInWithOtp({
      email: contact,
      options: { shouldCreateUser: false },
    })
    if (error) {
      return { error: "Erreur lors de l'envoi du code. Vérifiez votre email." }
    }
  } else {
    // Téléphone : format international requis (ex: +225070000000)
    const phone = contact.startsWith("+") ? contact : `+225${contact.replace(/\s/g, "")}`
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    })
    if (error) {
      return { error: "Erreur lors de l'envoi du SMS. Vérifiez votre numéro." }
    }
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
  const contact = formData.get("contact") as string
  const token = formData.get("token") as string

  if (!contact || !token) {
    return { error: "Code de vérification requis." }
  }

  const supabase = await createClient()

  const isEmail = contact.includes("@")

  const { error } = isEmail
    ? await supabase.auth.verifyOtp({ email: contact, token, type: "email" })
    : await supabase.auth.verifyOtp({
        phone: contact.startsWith("+") ? contact : `+225${contact.replace(/\s/g, "")}`,
        token,
        type: "sms",
      })

  if (error) {
    return { error: "Code invalide ou expiré. Veuillez réessayer." }
  }

  redirect("/parent/dashboard")
}
