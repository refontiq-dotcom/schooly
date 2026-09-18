"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  Plus,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react"
import { ActionForm } from "@/components/action-form"
import {
  getCourseSessions,
  createCourseSession,
  getHomeworks,
  createHomework,
  getAcademicDecisions,
  createAcademicDecision,
  getClassesForSchool,
  getSubjectsForSchool,
  getTeachersForSchool,
  getAcademicYearsForSchool,
  type CourseSessionRow,
  type HomeworkRow,
  type AcademicDecisionRow,
} from "./actions"
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
  const [loadingData, setLoadingData] = useState(true)

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

      setLoadingData(false)
    }

    loadAllData()
  }, [user])

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
        {(user?.role === "professeur" || user?.role === "direction") && (
          <Button><Plus className="h-4 w-4 mr-2" />Nouveau cours</Button>
        )}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Sessions de cours
              </CardTitle>
              <CardDescription>Planning des cours programmés pour cette période.</CardDescription>
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

          {(user?.role === "professeur" || user?.role === "direction") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Planifier une session
                </CardTitle>
                <CardDescription>Programmez un nouveau cours pour vos élèves.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm action={createCourseSession} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="classId">Classe</Label>
                    <Select id="classId" name="classId" required>
                      <option value="">Sélectionner</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subjectId">Matière</Label>
                    <Select id="subjectId" name="subjectId" required>
                      <option value="">Sélectionner</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="teacherId">Professeur</Label>
                    <Select id="teacherId" name="teacherId" required defaultValue={user?.id}>
                      <option value="">Sélectionner</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="academicYearId">Année</Label>
                    <Select id="academicYearId" name="academicYearId" required defaultValue={currentYear?.id}>
                      <option value="">Sélectionner</option>
                      {academicYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="startsAt">Heure de début</Label>
                    <Input id="startsAt" name="startsAt" type="datetime-local" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endsAt">Heure de fin</Label>
                    <Input id="endsAt" name="endsAt" type="datetime-local" required />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="room">Salle (optionnel)</Label>
                    <Input id="room" name="room" placeholder="Ex: Salle 101" />
                  </div>
                  <Button type="submit" className="sm:col-span-2">
                    <Plus className="h-4 w-4 mr-2" />Planifier
                  </Button>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="homeworks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Cahier de texte
              </CardTitle>
              <CardDescription>Devoirs et travaux assignés aux élèves.</CardDescription>
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

          {(user?.role === "professeur" || user?.role === "direction") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Ajouter un devoir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={createHomework} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="homeworkClassId">Classe</Label>
                    <Select id="homeworkClassId" name="classId" required>
                      <option value="">Sélectionner</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="homeworkSubjectId">Matière</Label>
                    <Select id="homeworkSubjectId" name="subjectId" required>
                      <option value="">Sélectionner</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="title">Titre du devoir</Label>
                    <Input id="title" name="title" placeholder="Ex: Exercices sur les fractions" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dueDate">Date d&apos;échéance</Label>
                    <Input id="dueDate" name="dueDate" type="date" required />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="description">Description (optionnel)</Label>
                    <textarea
                      id="description"
                      name="description"
                      className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Instructions détaillées pour les élèves..."
                    />
                  </div>
                  <Button type="submit" className="sm:col-span-2">
                    <Plus className="h-4 w-4 mr-2" />Créer le devoir
                  </Button>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Décisions du conseil de classe
              </CardTitle>
              <CardDescription>Admissions, redoublements et exclusions validées.</CardDescription>
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

          {(user?.role === "direction" || user?.role === "super_admin") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Enregistrer une décision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={createAcademicDecision} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Décision</Label>
                    <div className="flex gap-2">
                      {["admitted", "repeated", "excluded", "pending"].map(d => (
                        <label key={d} className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value={d}
                            className="sr-only"
                          />
                          <div className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-colors ${d === "admitted" ? "border-green-500 bg-green-50 text-green-700" : d === "repeated" ? "border-orange-500 bg-orange-50 text-orange-700" : d === "excluded" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-300 bg-gray-50 text-gray-600"}`}>
                            {d === "admitted" ? "Admis" : d === "repeated" ? "Redouble" : d === "excluded" ? "Exclu" : "En attente"}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="decisionEnrollmentId">Élève</Label>
                    <Select id="decisionEnrollmentId" name="enrollmentId" required>
                      <option value="">Sélectionner un élève</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="decisionYearId">Année académique</Label>
                    <Select id="decisionYearId" name="academicYearId" required defaultValue={currentYear?.id}>
                      <option value="">Sélectionner</option>
                      {academicYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="average">Moyenne générale (optionnel)</Label>
                    <Input id="average" name="average" type="number" step="0.01" min="0" max="20" placeholder="Ex: 12.50" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="observations">Observations</Label>
                    <textarea
                      id="observations"
                      name="observations"
                      className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Observations du conseil de classe..."
                    />
                  </div>
                  <Button type="submit" className="sm:col-span-2">
                    <Plus className="h-4 w-4 mr-2" />Enregistrer la décision
                  </Button>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
