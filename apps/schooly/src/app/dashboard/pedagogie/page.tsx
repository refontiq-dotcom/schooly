"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen,
  ClipboardList,
  Calendar,
  FileText,
} from "lucide-react"
import {
  getCourseSessions,
  getHomeworks,
  getAcademicDecisions,
  getClassesForSchool,
  getSubjectsForSchool,
  getTeachersForSchool,
  getAcademicYearsForSchool,
  getEnrollmentsForSchool,
  type CourseSessionRow,
  type HomeworkRow,
  type AcademicDecisionRow,
} from "./actions"
import { CreateSessionModal } from "./session-modal"
import { CreateHomeworkModal } from "./homework-modal"
import { CreateDecisionModal } from "./decision-modal"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { IntelligentGuidance } from "@/components/intelligent-guidance"

// Les types de lignes (CourseSessionRow, HomeworkRow, AcademicDecisionRow)
// sont importés de ./actions : source unique, fidèle au schéma (champs
// nullables) — les doublons locaux divergeaient à chaque migration.
type CourseSession = CourseSessionRow
type Homework = HomeworkRow
type AcademicDecision = AcademicDecisionRow

export default function PedagogieDashboard() {
  const user = useSupabaseUser()
  const [sessions, setSessions] = useState<CourseSession[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [decisions, setDecisions] = useState<AcademicDecision[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [academicYears, setAcademicYears] = useState<{ id: string; label: string; status: string }[]>([])
  const [enrollments, setEnrollments] = useState<Array<{ id: string; label: string }>>([])
  const [loadingData, setLoadingData] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const currentYear = academicYears.find(y => y.status === "en_cours")
  const plannedYear = academicYears.find(y => y.status === "planifiee")

  useEffect(() => {
    if (!user) return
    
    const loadAllData = async () => {
      setLoadingData(true)
      
      const sessionsRes = await getCourseSessions()
      if (sessionsRes.data) setSessions(sessionsRes.data)

      const homeworksRes = await getHomeworks()
      if (homeworksRes.data) setHomeworks(homeworksRes.data)

      const decisionsRes = await getAcademicDecisions()
      if (decisionsRes.data) setDecisions(decisionsRes.data)

      const classesRes = await getClassesForSchool()
      if (classesRes.data) setClasses(classesRes.data)

      const subjectsRes = await getSubjectsForSchool()
      if (subjectsRes.data) setSubjects(subjectsRes.data)

      const teachersRes = await getTeachersForSchool()
      if (teachersRes.data) setTeachers(teachersRes.data)

      const yearsRes = await getAcademicYearsForSchool()
      if (yearsRes.data) setAcademicYears(yearsRes.data)

      const enrollRes = await getEnrollmentsForSchool()
      if (enrollRes.data) {
        setEnrollments((enrollRes.data as any[]).map((e: any) => ({
          id: e.id,
          label: `${e.students?.last_name ?? ""} ${e.students?.first_name ?? ""}${e.classes?.name ? ` — ${e.classes.name}` : ""}`.trim(),
        })))
      }

      setLoadingData(false)
    }

    loadAllData()
  }, [user, refreshKey])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
  }

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "admitted": return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Admis</Badge>
      case "repeated": return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Redouble</Badge>
      case "excluded": return <Badge variant="destructive">Exclu</Badge>
      default: return <Badge variant="outline">En attente</Badge>
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        <p className="ml-3 text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Espace Pédagogique</h1>
          <p className="text-muted-foreground">
            Gestion des cours, appels, notes et bulletins pour l&apos;année académique en cours.
          </p>
        </div>
      </div>

      {!currentYear && (
        <Card className="border-orange-800/30 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-200">Aucune année académique en cours</h3>
                <p className="text-sm text-orange-900 dark:text-orange-300 mt-1">
                  {plannedYear
                    ? `« ${plannedYear.label} » est prête : ouvrez la structure pour l'activer.`
                    : "Ouvrez la structure : un formulaire prérempli crée et active la première année."}
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0 border-orange-800/30 text-orange-900 hover:bg-orange-100 dark:text-orange-200">
                <Link href="/dashboard/academic-structure">
                  {plannedYear ? `Activer ${plannedYear.label}` : "Créer l'année"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <IntelligentGuidance items={[
        ...(!currentYear ? [{ id: "year", title: "Aucune année académique n’est active", description: plannedYear ? `« ${plannedYear.label} » est prête à être activée.` : "Une année académique doit être créée et activée avant les opérations pédagogiques.", severity: "critical" as const, actionLabel: plannedYear ? `Activer ${plannedYear.label}` : "Ouvrir la structure", onAction: () => { window.location.href = "/dashboard/academic-structure" } }] : []),
        ...(classes.length === 0 ? [{ id: "classes", title: "Aucune classe pédagogique n’est prête", description: "Créez ou vérifiez la structure académique avant de programmer des cours.", severity: "critical" as const, actionLabel: "Préparer les classes", onAction: () => { window.location.href = "/dashboard/academic-structure" } }] : []),
        ...(subjects.length === 0 ? [{ id: "subjects", title: "Aucune matière n’est configurée", description: "Les matières sont nécessaires pour construire les cours et les évaluations.", severity: "action" as const, actionLabel: "Configurer les matières", onAction: () => { window.location.href = "/dashboard/academic-structure" } }] : []),
        ...(sessions.length === 0 && currentYear && classes.length > 0 && subjects.length > 0 ? [{ id: "schedule", title: "Aucun cours n’est encore programmé", description: "La structure est prête : la prochaine étape logique est de programmer un premier cours.", severity: "action" as const, actionLabel: "Programmer un cours", onAction: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }] : []),
      ]} />

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar className="h-4 w-4" />Cours & Appels
          </TabsTrigger>
          <TabsTrigger value="homeworks" className="gap-2">
            <BookOpen className="h-4 w-4" />Cahier de texte
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-2">
            <ClipboardList className="h-4 w-4" />Conseil de classe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Sessions de cours
                </CardTitle>
                <CardDescription>Planning des cours programmés pour cette période.</CardDescription>
              </div>
              {(user?.role === "professeur" || user?.role === "direction") && (
                <CreateSessionModal
                  classes={classes}
                  subjects={subjects}
                  teachers={teachers}
                  years={academicYears}
                  currentYearId={currentYear?.id}
                  defaultTeacherId={user?.id}
                  onSuccess={() => setRefreshKey((k) => k + 1)}
                />
              )}
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun cours programmé</p>
                  <p className="text-sm">Créez votre première session de cours pour commencer.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {session.classes?.name} — {session.subjects?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(session.starts_at)} · {session.starts_at.slice(11, 16)} — {session.ends_at.slice(11, 16)}
                            {session.room && ` · ${session.room}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground">
                          {session.users?.full_name || "Professeur à assigner"}
                        </Badge>
                        <Button size="sm" variant="outline">Appeler</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homeworks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Cahier de texte
                </CardTitle>
                <CardDescription>Devoirs et travaux assignés aux élèves.</CardDescription>
              </div>
              {(user?.role === "professeur" || user?.role === "direction") && (
                <CreateHomeworkModal
                  classes={classes}
                  subjects={subjects}
                  onSuccess={() => setRefreshKey((k) => k + 1)}
                />
              )}
            </CardHeader>
            <CardContent>
              {homeworks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun devoir assigné</p>
                  <p className="text-sm">Ajoutez votre premier devoir pour commencer.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {homeworks.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{h.title}</p>
                            {!h.is_published && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-300">Brouillon</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {h.subjects?.name} · {h.classes?.name}
                          </p>
                          {h.description && (
                            <p className="text-sm mt-1 text-muted-foreground">{h.description}</p>
                          )}
                          <p className="text-sm mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Calendar className="h-3 w-3" />
                            Échéance : {new Date(h.due_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">Modifier</Button>
                        <Button size="sm">Publier</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Décisions du conseil de classe
                </CardTitle>
                <CardDescription>Admissions, redoublements et exclusions validées.</CardDescription>
              </div>
              {(user?.role === "direction" || user?.role === "super_admin") && (
                <CreateDecisionModal
                  students={enrollments}
                  years={academicYears}
                  currentYearId={currentYear?.id}
                  onSuccess={() => setRefreshKey((k) => k + 1)}
                />
              )}
            </CardHeader>
            <CardContent>
              {decisions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucune décision enregistrée</p>
                  <p className="text-sm">Les décisions du conseil de classe apparaîtront ici.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map(d => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        {getDecisionBadge(d.decision)}
                        <div>
                          <p className="font-medium">
                            {d.enrollments?.students?.first_name} {d.enrollments?.students?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {d.enrollments?.classes?.name} · {d.academic_years?.label}
                            {d.average && ` · Moyenne: ${d.average.toFixed(2)}/20`}
                          </p>
                          {d.observations && (
                            <p className="text-sm mt-1 text-muted-foreground">{d.observations}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {((d as any).decided_at) ? new Date((d as any).decided_at).toLocaleDateString("fr-FR") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
