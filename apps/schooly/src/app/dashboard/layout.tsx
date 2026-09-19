import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { AcademicYearSelector } from "@/components/academic-year-selector"
import { GlobalSearch } from "@/components/global-search"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { GeminiBackdrop } from "@/components/gemini"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("role_code, school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!roleData?.role_code || !roleData.school_id) redirect("/login")

  const role = roleData.role_code
  const schoolId = roleData.school_id

  let schoolName = "Schooly"
  let schoolCity: string | null = null
  let schoolType: string | null = null
  let isSetupComplete = true

  const { data: school } = await admin
    .from("schools")
    .select("name, city, school_type, is_setup_complete")
    .eq("id", schoolId)
    .single()

  if (school) {
    schoolName = school.name
    schoolCity = school.city ?? null
    schoolType = school.school_type ?? null
    isSetupComplete = school.is_setup_complete ?? true
  }

  const showOnboarding = role === "direction" && !!schoolId && !isSetupComplete

  const { data: profile } = await admin
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  return (
    <div className="relative flex h-screen overflow-hidden bg-transparent p-2 sm:p-3">
      <GeminiBackdrop />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 gap-2 sm:gap-3">
        <Sidebar
          role={role}
          schoolName={schoolName}
          userName={profile?.full_name ?? user.email ?? "Utilisateur"}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/72 shadow-[0_18px_50px_oklch(0.2_0.05_252_/_0.08)] backdrop-blur-xl">
          <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/60 px-4 backdrop-blur-xl sm:gap-4 sm:px-7">
            <GlobalSearch />
            <AcademicYearSelector schoolId={schoolId} />
            <div className="hidden rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">
              {schoolName}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-1 py-1 sm:px-2 sm:py-2">
            {children}
          </main>

          {showOnboarding && (
            <OnboardingWizard
              schoolName={schoolName}
              schoolCity={schoolCity}
              schoolType={schoolType}
            />
          )}
        </div>
      </div>
    </div>
  )
}
