import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getFeeSchedules } from "@/app/dashboard/finance/actions"
import { CreditCard, DollarSign, FileText } from "lucide-react"

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!roleData?.school_id) redirect("/login")

  const { data: feeSchedules } = await getFeeSchedules(roleData.school_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion tarifaire, encaissements et exports comptables
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Tarifs configurés</p>
            <p className="text-2xl font-bold mt-1">{(feeSchedules || []).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Grille tarifaire</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Prochains exports</p>
            <p className="text-2xl font-bold mt-1">SYSCOHADA</p>
            <p className="text-xs text-muted-foreground mt-0.5">Disponible sur demande</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Statut caisse</p>
            <p className="text-2xl font-bold mt-1">À configurer</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ouvrir une session</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grille tarifaire</CardTitle>
          <CardDescription>
            Configurez les tarifs par niveau et profil financier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(feeSchedules || []).map((fs: any) => (
              <div key={fs.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <p className="font-medium">
                    {fs.grade_levels?.name} · {fs.financial_profiles?.name || "Standard"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fs.academic_years?.label} {fs.label ? `· ${fs.label}` : ""}
                  </p>
                </div>
                <span className="font-mono font-semibold">
                  {fs.amount.toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            ))}
            {(feeSchedules || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune grille tarifaire configurée.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
