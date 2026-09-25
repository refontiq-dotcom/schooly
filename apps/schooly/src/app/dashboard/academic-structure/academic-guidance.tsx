"use client"

import { ArrowRight, CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type AcademicGuidanceState = {
  hasCurrentYear: boolean
  hasPlannedYear: boolean
  levelsCount: number
  classesCount: number
  subjectsCount: number
  assignmentsCount: number
}

type Step = {
  id: string
  label: string
  description: string
  tab: string
  blocked: boolean
  done: boolean
}

export function buildAcademicGuidance(state: AcademicGuidanceState): Step[] {
  const yearReady = state.hasCurrentYear
  const levelsReady = state.levelsCount > 0
  const classesReady = state.classesCount > 0
  const subjectsReady = state.subjectsCount > 0
  const matrixReady = state.assignmentsCount > 0

  return [
    {
      id: "year",
      label: "Définir l'année académique",
      description: state.hasPlannedYear
        ? "Une année est planifiée : activez-la pour débloquer les opérations pédagogiques."
        : "Schooly a besoin d'une année en cours avant de construire le reste de la structure.",
      tab: "years",
      blocked: !yearReady,
      done: yearReady,
    },
    {
      id: "levels",
      label: "Créer les niveaux",
      description: "Les classes doivent toujours être rattachées à un niveau.",
      tab: "levels",
      blocked: !yearReady,
      done: levelsReady,
    },
    {
      id: "classes",
      label: "Créer les classes",
      description: "Chaque classe doit être rattachée à un niveau existant.",
      tab: "classes",
      blocked: !levelsReady,
      done: classesReady,
    },
    {
      id: "subjects",
      label: "Définir les matières",
      description: "Les matières servent ensuite à construire la matrice pédagogique.",
      tab: "subjects",
      blocked: !yearReady,
      done: subjectsReady,
    },
    {
      id: "matrix",
      label: "Construire la matrice",
      description: "Affectez les matières aux classes et, si besoin, leurs professeurs.",
      tab: "matrix",
      blocked: !classesReady || !subjectsReady,
      done: matrixReady,
    },
    {
      id: "rollover",
      label: "Préparer la bascule",
      description: "La bascule devient utile une fois la structure de l'établissement prête.",
      tab: "rollover",
      blocked: !yearReady || !classesReady,
      done: false,
    },
  ]
}

export function AcademicGuidancePanel({
  state,
  onNavigate,
}: {
  state: AcademicGuidanceState
  onNavigate: (tab: string, stepId: string) => void
}) {
  const steps = buildAcademicGuidance(state)
  const next = steps.find((step) => !step.done && !step.blocked) ?? steps.find((step) => !step.done)

  const completed = steps.filter((step) => step.done).length
  const blocked = steps.filter((step) => step.blocked && !step.done).length

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Schooly vous guide</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Les étapes sont proposées dans l&apos;ordre logique. Une étape bloquée indique ce qu&apos;il faut préparer avant de continuer.
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completed}/{steps.length} prêtes
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {next ? (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-start gap-3">
              {next.blocked ? (
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">Prochaine étape : {next.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => onNavigate(next.tab, next.id)}
                >
                  {next.blocked ? "Voir ce qu'il faut préparer" : "Commencer"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              className="flex items-start gap-2 rounded-lg border bg-background p-3 text-left transition hover:bg-muted/50"
              onClick={() => onNavigate(step.tab, step.id)}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : step.blocked ? (
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{step.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {step.done ? "Terminé" : step.blocked ? "Prérequis manquant" : "À faire"}
                </span>
              </span>
            </button>
          ))}
        </div>

        {blocked > 0 && (
          <p className="text-xs text-muted-foreground">
            Schooly évite de vous faire remplir une étape impossible : les prérequis sont identifiés automatiquement avant l&apos;action.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
