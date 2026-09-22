"use client"

import { useState, useEffect, useTransition, lazy, Suspense, type ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  BookOpen, GraduationCap, Users, FileText, LayoutGrid, RotateCw,
} from "lucide-react"
// Les panes sont chargés à la demande : un onglet non visité ne déclenche
// jamais son loader (getAcademicYears, getGradeLevels, getClassSubjectAssignments, …)
// au montage du hub. Ce n’est qu’au premier affichage de l’onglet que le code
// métier s’exécute — ce qui préserve le rendu du hub et les tests d’intégration.
const YearsPane = lazy(() => import("../years/page"))
const LevelsPane = lazy(() => import("../levels/page"))
const ClassesPane = lazy(() => import("../classes/page"))
const SubjectsPane = lazy(() => import("../subjects/page"))
const RolloverPane = lazy(() => import("../years/rollover"))
const MatrixPane = lazy(() => import("../matrix/page"))
import { getAcademicYears } from "../actions"
import { activateAcademicYear } from "../rollover-actions"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { computeAcademicWindow } from "@/components/academic-year-selector"
import type { AcademicYear } from "../_components/types"

type Tab = "years" | "levels" | "classes" | "subjects" | "matrix" | "rollover"

interface NavItem {
  id: Tab
  label: string
  icon: ReactNode
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { id: "years", label: "Années", icon: <BookOpen className="h-4 w-4" />, href: "/dashboard/academic-structure/years" },
  { id: "levels", label: "Niveaux", icon: <GraduationCap className="h-4 w-4" />, href: "/dashboard/academic-structure/levels" },
  { id: "classes", label: "Classes", icon: <Users className="h-4 w-4" />, href: "/dashboard/academic-structure/classes" },
  { id: "subjects", label: "Matières", icon: <FileText className="h-4 w-4" />, href: "/dashboard/academic-structure/subjects" },
  { id: "matrix", label: "Matrice", icon: <LayoutGrid className="h-4 w-4" />, href: "/dashboard/academic-structure/matrix" },
  { id: "rollover", label: "Bascule", icon: <RotateCw className="h-4 w-4" />, href: "/dashboard/academic-structure/rollover" },
]

export default function AcademicStructureTabs() {
  const user = useSupabaseUser()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [active, setActive] = useState<Tab>("years")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!user) return
    void (async () => {
      const res = await getAcademicYears()
      if (res.data) setYears(res.data as AcademicYear[])
      if (res.error) setError(res.error)
    })()
  }, [user])

  const currentYear = years.find((y) => y.status === "en_cours")
  const plannedYear = years.find((y) => y.status === "planifiee")
  const suggestedYear = computeAcademicWindow()

  const handleActivate = (yearId: string) => {
    startTransition(async () => {
      const res = await activateAcademicYear(yearId)
      if (res.error) setError(res.error)
      else {
        const ref = await getAcademicYears()
        if (ref.data) setYears(ref.data as AcademicYear[])
      }
    })
  }

  const canAccessMatrix = Boolean(currentYear)

  return (
    <div className="space-y-6">
      {!currentYear && (
        <Card className="border-orange-800/30 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-200">Aucune année académique en cours</h3>
                <p className="text-sm text-orange-900 dark:text-orange-300 mt-1">
                  {plannedYear
                    ? `Confirmez l'activation de « ${plannedYear.label} » pour débloquer les opérations pédagogiques.`
                    : `Schooly a besoin d'une année en cours avant de construire le reste de la structure.`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-orange-800/30 text-orange-900 hover:bg-orange-100 dark:text-orange-200"
                onClick={() => {
                  setError(null)
                  if (plannedYear) void handleActivate(plannedYear.id)
                }}
              >
                {plannedYear ? `Activer ${plannedYear.label}` : `Créer ${suggestedYear.label}`}
              </Button>
            </div>
                   </CardContent>
        </Card>
      )}

      {currentYear && (
        <p className="text-sm text-muted-foreground">
          Année en cours :{" "}
          <span className="font-medium text-foreground">{currentYear.label}</span>
        </p>
      )}

      <nav aria-label="Onglets de structure" className="border-b border-border">
        {NAV_ITEMS.filter((item) => {
          if (item.id === "matrix") return canAccessMatrix
          return true
        }).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active === item.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActive(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

                  <div className="pt-2">
        {active === "years" && (
          <Suspense fallback={null}>
            <YearsPane />
          </Suspense>
        )}
        {active === "levels" && (
          <Suspense fallback={null}>
            <LevelsPane />
          </Suspense>
        )}
        {active === "classes" && (
          <Suspense fallback={null}>
            <ClassesPane />
          </Suspense>
        )}
        {active === "subjects" && (
          <Suspense fallback={null}>
            <SubjectsPane />
          </Suspense>
        )}
        {active === "matrix" && canAccessMatrix && (
          <Suspense fallback={null}>
            <MatrixPane />
          </Suspense>
        )}
        {active === "rollover" && (
          <Suspense fallback={null}>
            <RolloverPane />
          </Suspense>
        )}
      </div>
    </div>
  )
}

