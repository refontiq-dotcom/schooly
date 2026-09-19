"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type OnboardingResult = { error: string | null }

// Rôles autorisés à configurer l'établissement (fondateur = direction).
const SETUP_ROLES = ["direction"]

// Valeurs valides de l'enum public.school_type (mirror de la migration 00001).
const VALID_SCHOOL_TYPES = [
  "primaire",
  "college",
  "lycee",
  "professionnel",
  "islamique",
  "superieur",
] as const

async function resolveSchoolId(userId: string): Promise<string | null> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data, error } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role_code", SETUP_ROLES)
    .limit(1)
    .single()

  return data?.school_id ?? null
}

/**
 * Finalise l'onboarding : écrit la configuration de base de l'école
 * (ville + type) et passe is_setup_complete = true, ce qui supprime la
 * modale du wizard du dashboard. Crée éventuellement la première année
 * académique fournie par l'utilisateur.
 *
 * Résolu côté serveur depuis la session courante (jamais depuis les props
 * client) → isolation multi-écoles garantie.
 */
export async function completeOnboardingAction(
  _prevState: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Non autorisé." }

  const schoolId = await resolveSchoolId(user.id)
  if (!schoolId) return { error: "Aucune école rattachée à votre compte." }

  const city = (formData.get("city") as string | null)?.trim() || null
  const schoolType = (formData.get("school_type") as string | null)?.trim() || ""
  const yearLabel = (formData.get("yearLabel") as string | null)?.trim() || null
  const startDate = (formData.get("startDate") as string | null)?.trim() || null
  const endDate = (formData.get("endDate") as string | null)?.trim() || null

  // Validation
  if (!VALID_SCHOOL_TYPES.includes(schoolType as (typeof VALID_SCHOOL_TYPES)[number])) {
    return { error: "Type d'établissement invalide." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // 1. Configuration de base de l'établissement + marquage comme configurée
  const { error: schoolError } = await admin
    .from("schools")
    .update({
      city: city,
      school_type: schoolType,
      is_setup_complete: true,
    })
    .eq("id", schoolId)

  if (schoolError) {
    console.error("[onboarding] school update error:", schoolError)
    return { error: `Erreur configuration école : ${schoolError.message}` }
  }

  // 2. Année académique optionnelle (peut être créée plus tard via Structure académique)
  if (yearLabel && startDate && endDate) {
    const { error: yearError } = await admin.from("academic_years").insert({
      school_id: schoolId,
      label: yearLabel,
      start_date: startDate,
      end_date: endDate,
      status: "en_cours",
    })

    if (yearError) {
      // L'onboarding est quand même considéré comme terminé — on ne bloque pas
      // l'accès au dashboard sur un échec de création d'année.
      console.warn("[onboarding] academic year creation failed:", yearError.message)
    }
  }

  // Forcer le re-rendu serveur du dashboard → la modale disparaît (flag = true).
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/direction")
  redirect("/dashboard/direction")
}
