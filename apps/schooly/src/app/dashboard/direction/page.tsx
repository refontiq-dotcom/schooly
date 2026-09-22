import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getDirectionDashboard } from "./dashboard-data"
import { DashboardView } from "./_components/dashboard-view"

/**
 * Bilan direction — wrapper serveur : auth, rôle et chargement des données.
 * Toute la présentation vit dans _components/dashboard-view.tsx.
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
    .from("school_users")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  const schoolId =
    roleData?.school_id ??
    (user.app_metadata?.school_id as string | undefined)

  if (!schoolId) redirect("/login")

  const cookieStore = await cookies()
  const preferredYearId =
    cookieStore.get("active_academic_year_id")?.value ?? null

  const dashboard = await getDirectionDashboard(admin, schoolId, {
    preferredYearId,
  })

  return <DashboardView dashboard={dashboard} />
}
