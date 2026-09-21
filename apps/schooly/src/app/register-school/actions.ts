"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

const LEGAL_VERSION = "1.0"

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
  const legalAccepted = formData.get("legalAccepted") === "on"

  if (!schoolName || !fullName || !email || !password) {
    return { error: "Tous les champs sont requis." }
  }

  if (!legalAccepted) {
    return { error: "Vous devez accepter les Conditions Générales de Service et la Politique de confidentialité." }
  }

  // Service role uniquement côté serveur pour créer le compte et l'établissement.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!
  const adminAuthClient = createAdminClient(supabaseUrl, supabaseSecretKey)

  try {
    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError || !authData.user) {
      console.error("[register] Auth error:", authError)
      return { error: authError?.message || "Erreur lors de la création du compte." }
    }

    const userId = authData.user.id

    const { data: schoolData, error: schoolError } = await adminAuthClient
      .from("schools")
      .insert({ name: schoolName })
      .select()
      .single()

    if (schoolError || !schoolData) {
      console.error("[register] School creation error:", schoolError)
      await adminAuthClient.auth.admin.deleteUser(userId)
      return { error: `Erreur DB: ${schoolError?.message || "Impossible de créer l'établissement"}` }
    }

    const schoolId = schoolData.id

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
      await adminAuthClient.auth.admin.deleteUser(userId)
      await adminAuthClient.from("schools").delete().eq("id", schoolId)
      return { error: "Erreur lors de l'attribution du rôle de direction." }
    }

    const { error: legalError } = await adminAuthClient
      .from("legal_document_acceptances")
      .insert([
        {
          school_id: schoolId,
          user_id: userId,
          document_key: "conditions-generales-service",
          document_version: LEGAL_VERSION,
        },
        {
          school_id: schoolId,
          user_id: userId,
          document_key: "politique-confidentialite",
          document_version: LEGAL_VERSION,
        },
      ])

    if (legalError) {
      console.error("[register] Legal acceptance error:", legalError)
      await adminAuthClient.auth.admin.deleteUser(userId)
      await adminAuthClient.from("schools").delete().eq("id", schoolId)
      return { error: "Impossible d'enregistrer l'acceptation des documents juridiques." }
    }

    const sessionClient = await createClient()
    await sessionClient.auth.signOut()
  } catch (err) {
    console.error("[register] Unexpected error:", err)
    return { error: "Une erreur inattendue est survenue." }
  }

  redirect("/login?registered=true")
}
