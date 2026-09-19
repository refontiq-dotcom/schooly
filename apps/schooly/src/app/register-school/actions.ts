"use server"

import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

type RegisterResult = {
  error: string | null
}

export async function registerSchoolAction(
  prevState: RegisterResult,
  formData: FormData
): Promise<RegisterResult> {
  const schoolName = formData.get("schoolName") as string
  const fullName = formData.get("fullName") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!schoolName || !fullName || !email || !password) {
    return { error: "Tous les champs sont requis." }
  }

  // Utilisation de la Service Role Key pour contourner RLS et insérer l'école et l'utilisateur
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!
  const adminAuthClient = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Créer le compte utilisateur
    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Si "Confirm Email" est activé dans les settings Supabase, on force la confirmation
      user_metadata: { full_name: fullName }
    })

    if (authError || !authData.user) {
      console.error("[register] Auth error:", authError)
      return { error: authError?.message || "Erreur lors de la création du compte." }
    }

    const userId = authData.user.id

    // 2. Créer l'école
    const { data: schoolData, error: schoolError } = await adminAuthClient
      .from("schools")
      .insert({
        name: schoolName
      })
      .select()
      .single()

    if (schoolError || !schoolData) {
      console.error("[register] School creation error:", schoolError)
      // Nettoyage de l'utilisateur si la création de l'école échoue
      await adminAuthClient.auth.admin.deleteUser(userId)
      return { error: `Erreur DB: ${schoolError?.message || "Impossible de créer l'établissement"}` }
    }

    const schoolId = schoolData.id

    // 3. Assigner le rôle "direction" au fondateur pour cette école
    const { error: roleError } = await adminAuthClient
      .from("user_school_roles")
      .insert({
        user_id: userId,
        school_id: schoolId,
        role_code: "direction",
        is_active: true
      })

    if (roleError) {
      console.error("[register] Role assignment error:", roleError)
      return { error: "Erreur lors de l'attribution du rôle de direction." }
    }

    // Le compte et l'école sont créés avec succès en base.
    // L'utilisateur devra se connecter manuellement la première fois, 
    // car le SDK Admin n'établit pas de session de cookies.

  } catch (err) {
    console.error("[register] Unexpected error:", err)
    return { error: "Une erreur inattendue est survenue." }
  }

  // Redirection vers login pour qu'il se connecte avec son nouveau compte
  redirect("/login?registered=true")
}
