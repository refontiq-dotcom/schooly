import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IntelligentGuidance } from "@/components/intelligent-guidance"
import { getDirectionDashboard } from "../dashboard-data"
import { formatFCFA } from "@/lib/formatters"
import { ArrowRight, BarChart3, CreditCard, GraduationCap, Users } from "lucide-react"

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["direction", "informatique", "compta", "super_admin"] })
  if (!guard.ok) redirect("/login")
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const schoolId = guard.context.schoolId
  const isIT = guard.context.roleCode === "informatique"
  const dashboard = await getDirectionDashboard(admin, schoolId)
  const guidance = [
    ...(!dashboard.activeYear ? [{ id: "year", title: "Le bilan est limité : aucune année active", description: "Activez une année académique pour obtenir des indicateurs comparables et exploitables.", severity: "critical" as const, actionLabel: "Préparer la structure", href: "/dashboard/academic-structure" }] : []),
    ...(!isIT && dashboard.finance.debtorsCount > 0 ? [{ id: "debt", title: "Le rapport financier doit attirer l’attention sur les impayés", description: `${dashboard.finance.debtorsCount} élève(s) ont un solde restant à recouvrer.`, severity: "warning" as const, actionLabel: "Voir les relances", href: "/dashboard/direction/finance/reminders" }] : []),
    ...(dashboard.students.byLevel.some(l => (l.fillRate ?? 0) >= 90) ? [{ id: "capacity", title: "Risque de saturation détecté", description: "Certains niveaux approchent de leur capacité configurée. Vérifiez les places avant de confirmer de nouvelles admissions.", severity: "warning" as const, actionLabel: "Voir la structure", href: "/dashboard/academic-structure" }] : []),
  ]
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight">Rapports</h1><p className="text-sm text-muted-foreground">Une vue synthétique des indicateurs de l’établissement et des décisions à prendre.</p></div>
    <IntelligentGuidance items={guidance} title="Schooly analyse vos indicateurs" />
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Effectifs</CardTitle><CardDescription>Année active : {dashboard.activeYear?.label ?? "aucune"}</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{dashboard.students.active}</p><p className="text-xs text-muted-foreground">élève(s) actif(s)</p></CardContent></Card>
      {!isIT && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" />Finance</CardTitle><CardDescription>Taux de recouvrement</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{dashboard.finance.recoveryRate.toFixed(1)} %</p><p className="text-xs text-muted-foreground">{formatFCFA(dashboard.finance.outstanding)} restant à recouvrer</p></CardContent></Card>}
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" />Actions</CardTitle><CardDescription>Décisions en attente</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{dashboard.actionQueue.reduce((sum, item) => sum + item.count, 0)}</p><p className="text-xs text-muted-foreground">élément(s) à traiter</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Rapports opérationnels</CardTitle><CardDescription>Accédez directement aux sources détaillées plutôt que de chercher dans les menus.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">
      {!isIT && <Button asChild variant="outline" className="justify-between"><Link href="/dashboard/direction/finance">Rapport financier <ArrowRight className="h-4 w-4" /></Link></Button>}
      <Button asChild variant="outline" className="justify-between"><Link href="/dashboard/direction/admissions">Rapport admissions / inscriptions <ArrowRight className="h-4 w-4" /></Link></Button>
      <Button asChild variant="outline" className="justify-between"><Link href="/dashboard/academic-structure">Structure académique <GraduationCap className="h-4 w-4" /></Link></Button>
      <Button asChild variant="outline" className="justify-between"><Link href="/dashboard/direction">Bilan direction <BarChart3 className="h-4 w-4" /></Link></Button>
    </CardContent></Card>
  </div>
}
