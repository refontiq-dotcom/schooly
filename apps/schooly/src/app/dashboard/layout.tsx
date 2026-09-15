import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { AcademicYearSelector } from "@/components/academic-year-selector"
import { OnboardingWizard } from "@/components/onboarding-wizard"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Récupérer le rôle et l'école depuis la base (sans dépendre du hook JWT)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("role_code, school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  const role = roleData?.role_code ?? "direction"
  const schoolId = roleData?.school_id

    // Récupérer le nom de l'école + état d'onboarding
  let schoolName = "Schooly"
  let schoolCity: string | null = null
  let schoolType: string | null = null
  let isSetupComplete = true
  if (schoolId) {
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
  }

  // Le fondateur d'une école non configurée doit passer par le wizard d'onboarding
  // (déclenché à la première connexion après l'inscription via /register-school).
  const showOnboarding = role === "direction" && !!schoolId && !isSetupComplete

  // Récupérer le nom complet de l'utilisateur
  const { data: profile } = await admin
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        role={role}
        schoolName={schoolName}
        userName={profile?.full_name ?? user.email ?? "Utilisateur"}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Bannière supérieure avec sélecteur d'année académique */}
        <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-6 shrink-0">
          <AcademicYearSelector schoolId={schoolId} />
          <div className="text-xs text-muted-foreground">
            {schoolName}
          </div>
        </header>
                <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Wizard d'onboarding (obligatoire tant que l'école n'est pas configurée) */}
        {showOnboarding && (
          <OnboardingWizard
            schoolName={schoolName}
            schoolCity={schoolCity}
            schoolType={schoolType}
          />
        )}
      </div>
    </div>
  )
}
