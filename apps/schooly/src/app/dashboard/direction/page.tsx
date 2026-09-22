import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { roleHome } from "@/utils/supabase/route-rules"
import { getDirectionDashboard } from "./dashboard-data"
import { DashboardView } from "./_components/dashboard-view"

/**
 * Bilan direction — wrapper serveur : auth, rôle et chargement des données.
 * Toute la présentation vit dans _components/dashboard-view.tsx.
 *
 * P0-1 : la table lue est `user_school_roles` (l'ancienne `school_users`
 * n'existe dans aucune migration — la lecture retournait toujours null et
 * éjectait les directeurs sans claim JWT vers /login).
 */
export default async function DirectionDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  const { data: roleData } = await supabase
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const schoolId =
    (roleData as { school_id?: string } | null)?.school_id ??
    (user.app_metadata?.school_id as string | undefined)

  if (!schoolId) redirect("/login")

  // Garde rôle explicite : le proxy protège déjà l'URL, mais un non-directeur
  // arrivé ici (lien direct, rôle changé) ne doit pas voir le cockpit.
  // super_admin (Control Center) garde l'accès lecture au cockpit.
  const roleCode = (roleData as { role_code?: string } | null)?.role_code
  if (roleCode !== "direction" && roleCode !== "super_admin") {
    redirect(roleHome(roleCode) ?? "/login")
  }

  const cookieStore = await cookies()
  const preferredYearId =
    cookieStore.get("active_academic_year_id")?.value ?? null

  const dashboard = await getDirectionDashboard(admin, schoolId, {
    preferredYearId,
  })

  return <DashboardView dashboard={dashboard} />
}
