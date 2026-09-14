import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, CreditCard, GraduationCap, TrendingUp } from "lucide-react"

export default async function DirectionDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const schoolId = user.app_metadata?.school_id as string | undefined

  // Compteurs rapides (à remplacer par de vraies requêtes quand les tables existent)
  const stats = [
    { label: "Élèves inscrits", value: "—", icon: Users, color: "text-primary" },
    { label: "Encaissé ce mois", value: "—", icon: CreditCard, color: "text-green-600" },
    { label: "Classes configurées", value: "—", icon: GraduationCap, color: "text-blue-600" },
    { label: "Taux de recouvrement", value: "—", icon: TrendingUp, color: "text-amber-600" },
  ]

  return (
    <div className="p-6 space-y-8">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vue d'ensemble de votre établissement
          </p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Année académique 2025-2026
        </Badge>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Données disponibles dès la Phase 2
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder Prochaines actions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">🚧 Modules en cours de développement</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>📅 <strong>Phase 2</strong> — Structure académique (années, classes, matières)</li>
            <li>🎓 <strong>Phase 3</strong> — Inscriptions & pré-inscriptions des élèves</li>
            <li>💰 <strong>Phase 4</strong> — Tarification, caisse & reçus QR</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
