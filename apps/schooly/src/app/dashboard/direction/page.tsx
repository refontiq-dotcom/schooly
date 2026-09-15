import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, CreditCard, GraduationCap, TrendingUp, ArrowRight } from "lucide-react"
import { formatFCFA } from "@/lib/formatters"
import { getDashboardMetrics, type DashboardMetrics } from "./actions"

const QUICK_LINKS = [
  { label: "Gérer les inscriptions", href: "/dashboard/direction/admissions" },
  { label: "Configurer l'année scolaire", href: "/dashboard/academic-structure" },
  { label: "Suivre les paiements", href: "/dashboard/direction/finance" },
]

export default async function DirectionDashboard() {
  let metrics: DashboardMetrics
  try {
    metrics = await getDashboardMetrics()
  } catch {
    redirect("/login")
  }

  const monthLabel = new Date().toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  })

  const stats = [
    {
      label: "Élèves inscrits",
      value: metrics.activeStudents.toLocaleString("fr-FR"),
      hint: metrics.academicYearLabel
        ? `Année ${metrics.academicYearLabel}`
        : "Aucune année active",
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Encaissé ce mois",
      value: formatFCFA(metrics.collectedThisMonth),
      hint: monthLabel,
      icon: CreditCard,
      color: "text-green-600",
    },
    {
      label: "Classes configurées",
      value: metrics.configuredClasses.toLocaleString("fr-FR"),
      hint: "Structure académique",
      icon: GraduationCap,
      color: "text-blue-600",
    },
    {
      label: "Taux de recouvrement",
      value: metrics.recoveryRate === null ? "—" : `${metrics.recoveryRate}%`,
      hint:
        metrics.expectedForYear > 0
          ? `${formatFCFA(metrics.collectedForYear)} sur ${formatFCFA(metrics.expectedForYear)}`
          : "Aucun frais paramétré",
      icon: TrendingUp,
      color: "text-amber-600",
    },
  ]

  return (
    <div className="p-6 space-y-8">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vue d&apos;ensemble de {metrics.schoolName}
          </p>
        </div>
        {metrics.academicYearLabel && (
          <Badge variant="outline" className="text-primary border-primary">
            Année académique {metrics.academicYearLabel}
          </Badge>
        )}
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
              <p className="text-xs text-muted-foreground mt-1">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions rapides */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Actions rapides</CardTitle>
          <CardDescription>Accédez directement aux modules essentiels.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
