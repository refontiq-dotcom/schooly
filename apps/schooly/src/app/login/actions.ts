"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { roleHome } from "@/utils/supabase/route-rules"

type LoginResult = {
  error: string | null
}

export async function loginAction(
  prevState: LoginResult,
  formData: FormData
): Promise<LoginResult> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email et mot de passe requis." }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("[login] Auth error:", error.message)
    return { error: `Identifiants incorrects. (${error.message})` }
  }

  if (!data.user) {
    return { error: "Erreur inattendue. Veuillez réessayer." }
  }

  const userId = data.user.id

  // Récupérer le rôle actif via la base de données (sans dépendre du hook JWT)
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: roleData } = await adminClient
    .from("user_school_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)

  const role = roleData?.[0]?.role_code
  console.log("[login] Utilisateur connecté:", data.user.email, "| rôle:", role ?? "AUCUN")

  if (!role) {
    return {
      error:
        "Votre compte est bien reconnu mais aucun rôle n'est attribué. Contactez l'administrateur de votre établissement.",
    }
  }

  // Table de routage partagée avec le proxy (source unique de vérité).
  const destination = roleHome(role)

  if (!destination) {
    // Ne JAMAIS rediriger vers /login ici : l'utilisateur vient de s'authentifier,
    // cela produirait une boucle de connexion silencieuse.
    return {
      error:
        "Ce compte est valide mais n'a pas d'espace dans l'application d'administration. Utilisez l'application dédiée.",
    }
  }

  redirect(destination)
}
