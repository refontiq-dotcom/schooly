import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wrench, GraduationCap, FileText, Settings, ArrowRight } from "lucide-react"

export default async function InformatiqueDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const guard = await requireSchoolRole(supabase, { allowedRoles: ["informatique"] })
  if (!guard.ok) redirect("/login")

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Administration Schooly</p>
        <h1 className="text-3xl font-semibold tracking-tight">Espace informatique</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Schooly prépare automatiquement les opérations. Votre rôle est de contrôler la configuration,
          vérifier les résultats et valider ce qui doit l&apos;être.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="p-5">
          <p className="font-medium">Principe de travail</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pas besoin de tout refaire manuellement : configurez une fois l&apos;établissement, puis laissez
            Schooly préparer les structures, rapports et documents. Intervenez seulement lorsqu&apos;une confirmation est nécessaire.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" />Configuration académique</CardTitle>
            <CardDescription>Années, niveaux, classes, matières et affectations.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild variant="outline"><Link href="/dashboard/academic-structure">Ouvrir <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" />Paramètres établissement</CardTitle>
            <CardDescription>Identité et configuration générale de l&apos;établissement.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild variant="outline"><Link href="/dashboard/direction/settings">Configurer <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Bulletins & rapports</CardTitle>
            <CardDescription>Contrôlez les données et préparez les documents administratifs.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild variant="outline"><Link href="/dashboard/direction/reports">Ouvrir <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Contrôle</CardTitle>
            <CardDescription>Les droits de votre rôle restent limités aux opérations techniques et administratives prévues.</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">La direction conserve le pilotage des rôles, des décisions sensibles et des accès du personnel.</p></CardContent>
        </Card>
      </div>
    </div>
  )
}
