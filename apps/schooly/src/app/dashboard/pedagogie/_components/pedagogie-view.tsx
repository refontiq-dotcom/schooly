"use client"

import { useCallback, useMemo, useRef } from "react"
import { BookOpen, Calendar, ClipboardList } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntelligentGuidance } from "@/components/intelligent-guidance"
import { SessionsSection } from "./sessions-section"
import { HomeworksSection } from "./homeworks-section"
import { DecisionsSection } from "./decisions-section"
import { buildPedagogieGuidance } from "../_lib/helpers"
import type {
  ClassOption,
  DecisionRow,
  EnrollmentListRow,
  HomeworkListRow,
  SessionRow,
  SubjectOption,
  TeacherOption,
  YearOption,
} from "../_lib/types"

type PedagogieViewProps = {
  classes: ClassOption[]
  subjects: SubjectOption[]
  teachers: TeacherOption[]
  years: YearOption[]
  currentYearId?: string
  currentYearLabel?: string
  plannedYearLabel?: string
  defaultTeacherId?: string
  sessions: SessionRow[]
  homeworks: HomeworkListRow[]
  decisions: DecisionRow[]
  enrollments: EnrollmentListRow[]
  /** Rôle d'écriture pédagogique (cours, devoirs). */
  canWriteContent: boolean
  /** Rôle d'écriture des décisions du conseil de classe. */
  canDecide: boolean
  /** Rechargement des données après une création. */
  onRefresh: () => void
  /** Navigation vers la structure académique (guidance). */
  onNavigateToStructure: () => void
}

/** « 1 classe » / « 4 classes » — évite les libellés au pluriel fautif. */
function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * Hub pédagogique : en-tête + guidance puis les trois onglets métier
 * (cours, cahier de texte, conseil de classe). Les règles de guidance vivent
 * dans `_lib/helpers` (testables) ; ici on ne fait que traduire l'action
 * déclarative en navigation.
 */
export function PedagogieView({
  classes,
  subjects,
  teachers,
  years,
  currentYearId,
  currentYearLabel,
  plannedYearLabel,
  defaultTeacherId,
  sessions,
  homeworks,
  decisions,
  enrollments,
  canWriteContent,
  canDecide,
  onRefresh,
  onNavigateToStructure,
}: PedagogieViewProps) {
  const sessionsTabRef = useRef<HTMLDivElement>(null)

  const scrollToSessions = useCallback(() => {
    sessionsTabRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [])

  const guidanceItems = useMemo(
    () =>
      buildPedagogieGuidance({
        hasCurrentYear: Boolean(currentYearId),
        plannedYearLabel: plannedYearLabel ?? null,
        classesCount: classes.length,
        subjectsCount: subjects.length,
        sessionsCount: sessions.length,
      }).map(({ action, ...item }) => ({
        ...item,
        onAction: action === "open-structure" ? onNavigateToStructure : scrollToSessions,
      })),
    [classes.length, currentYearId, onNavigateToStructure, plannedYearLabel, scrollToSessions, sessions.length, subjects.length],
  )

  const structureSummary = [
    currentYearLabel ? `Année en cours : ${currentYearLabel}` : "Aucune année active",
    countLabel(classes.length, "classe", "classes"),
    countLabel(subjects.length, "matière", "matières"),
  ].join(" · ")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Espace Pédagogique</h1>
        <p className="text-muted-foreground">
          Gestion des cours, appels, notes et bulletins pour l&apos;année académique en cours.
        </p>
        <p className="text-sm text-muted-foreground mt-1">{structureSummary}</p>
      </div>

      <IntelligentGuidance items={guidanceItems} contextKey="pedagogie" />

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar className="h-4 w-4" />
            Cours &amp; Appels
          </TabsTrigger>
          <TabsTrigger value="homeworks" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Cahier de texte
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Conseil de classe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <div ref={sessionsTabRef}>
            <SessionsSection
              sessions={sessions}
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              years={years}
              currentYearId={currentYearId}
              defaultTeacherId={defaultTeacherId}
              canCreate={canWriteContent}
              onSuccess={onRefresh}
            />
          </div>
        </TabsContent>

        <TabsContent value="homeworks" className="space-y-4">
          <HomeworksSection
            homeworks={homeworks}
            classes={classes}
            subjects={subjects}
            canCreate={canWriteContent}
            onSuccess={onRefresh}
          />
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <DecisionsSection
            decisions={decisions}
            enrollments={enrollments}
            years={years}
            currentYearId={currentYearId}
            canRecord={canDecide}
            onSuccess={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
