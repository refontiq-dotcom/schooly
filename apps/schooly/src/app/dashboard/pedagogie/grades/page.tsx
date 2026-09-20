// apps/schooly/src/app/dashboard/pedagogie/grades/page.tsx
//
// Hub du module d'évaluation. Cet écran ne charge aucune donnée métier : il
// sépare deux temps qui n'ont ni le même rythme ni les mêmes responsabilités.
//
// Avant, un écran unique empilait sept sections (règles, calendrier, saisie,
// moyennes, décision annuelle, bulletins, historique) : l'enseignant devait
// traverser les actes officiels de fin d'année pour saisir une note du jour.
// La divulgation progressive est ici structurelle — deux destinations, chacune
// portant ses propres paliers (onglets pour la saisie, étapes numérotées pour
// les bulletins).
"use client"

import type { ComponentType, SVGProps } from "react"
import Link from "next/link"
import { FileText, GraduationCap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSupabaseUser } from "@/hooks/use-supabase-user"

interface GradesEntry {
  href: string
  title: string
  description: string
  cta: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  directionOnly: boolean
}

// Destinations du module. `directionOnly` reproduit la garde d'accès de
// l'écran cible : inutile de proposer un lien qui refusera l'accès.
const ENTRIES: readonly GradesEntry[] = [
  {
    href: "notes",
    title: "Notes",
    description:
      "Saisir les évaluations de la période. Barèmes, moyennes et historique sont derrière des onglets.",
    cta: "Saisir une note",
    icon: GraduationCap,
    directionOnly: false,
  },
  {
    href: "report-cards",
    title: "Bulletins",
    description:
      "Générer les bulletins en fin de période et les publier aux familles, après décision validée.",
    cta: "Générer les bulletins",
    icon: FileText,
    directionOnly: true,
  },
]

export default function GradesHubPage() {
  const user = useSupabaseUser()
  // Session inconnue : ne rien afficher plutôt que de proposer une entrée qui
  // disparaîtra au premier rendu hydraté.
  if (!user) return null

  const isDirection = user.role === "direction" || user.role === "super_admin"
  const entries = ENTRIES.filter((entry) => !entry.directionOnly || isDirection)

  return (
    <div className="space-y-8">
      <header className="max-w-2xl space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Pédagogie</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Évaluation</h1>
        <p className="text-muted-foreground">
          Deux temps distincts dans l’année scolaire : la saisie au fil des cours, puis les actes
          officiels qui figent les résultats.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {entries.map((entry) => {
          const Icon = entry.icon
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="group rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full gap-4 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_oklch(0.2_0.05_252_/_0.12)] group-focus-visible:-translate-y-0.5">
                <CardHeader className="gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="font-heading text-xl">{entry.title}</CardTitle>
                  <CardDescription>{entry.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-primary underline-offset-4 group-hover:underline">
                    {entry.cta}
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
