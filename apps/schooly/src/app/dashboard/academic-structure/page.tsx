"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Play, BookOpen, GraduationCap, Users, FileText, RotateCcw, Loader2, Pencil, Trash2 } from "lucide-react"
import { YearRolloverPanel } from "./year-rollover-panel"
import { activateAcademicYear } from "./rollover-actions"
import {
  createAcademicYear,
  createGradeLevel,
  createClass,
  createSubject,
  createClassSubjectAssignment,
  getAcademicYears,
  getGradeLevels,
  getClasses,
  getSubjects,
  getClassSubjectAssignments,
  getTeachersForSchool,
  updateSubject,
  archiveSubject,
  updateClass,
  archiveClass,
  updateGradeLevel,
  archiveGradeLevel,
  archiveAcademicYear,
  updateClassSubjectAssignment,
  archiveClassSubjectAssignment,
} from "./actions"
import { ActionForm } from "@/components/action-form"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { computeAcademicWindow } from "@/components/academic-year-selector"

type AcademicYear = { id: string; label: string; status: string }
type GradeLevel = { id: string; name: string; level: number; cycle: string }
type ClassItem = {
  id: string
  name: string
  capacity: number | null
  head_teacher_id?: string | null
  grade_levels?: { name: string }
  users?: { full_name: string }
}
type Subject = { id: string; name: string; code: string | null; coefficient: number }
type Assignment = {
  id: string
  classes?: { name: string }
  subjects?: { name: string }
  coefficient: number
  teacher_id?: string | null
  users?: { full_name: string }
}
type Teacher = { id: string; full_name: string }

/**
 * Enveloppe un Server Action de création pour recharger la liste concernée
 * après un succès : l'état local de cette page cliente ne se rafraîchit pas
 * tout seul (`revalidatePath` ne concerne que le rendu serveur), les listes
 * restaient donc figées jusqu'à un rechargement manuel.
 */
function withReload(
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>,
  reload: () => Promise<void>,
) {
  return async (formData: FormData) => {
    const result = await action(formData)
    if (!result?.error) await reload()
    return result
  }
}

/**
 * Archivage (suppression logique) d'une ligne du référentiel.
 * Confirmation obligatoire — aucune action destructrice sans confirmation —
 * refus affiché tel quel (les règles métier vivent côté serveur : élément
 * encore utilisé, année en cours…), puis rechargement de la liste.
 */
function ArchiveButton({
  action,
  id,
  title,
  confirmMessage,
  onDone,
}: {
  action: (id: string) => Promise<{ error?: string }>
  id: string
  title: string
  confirmMessage: string
  onDone: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <span className="flex items-center gap-2">
      {error && <span className="max-w-[280px] text-xs text-destructive">{error}</span>}
      <Button
        size="sm"
        variant="ghost"
        title={title}
        aria-label={title}
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return
          setError(null)
          startTransition(async () => {
            const res = await action(id)
            if (res?.error) {
              setError(res.error)
              return
            }
            await onDone()
          })
        }}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </span>
  )
}

/**
 * Correction en ligne : le crayon ouvre un formulaire pré-rempli (mêmes champs
 * que la création + l'identifiant en champ caché). Le formulaire se referme
 * après un enregistrement réussi.
 */
function InlineEdit({
  action,
  onDone,
  children,
}: {
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>
  onDone: () => Promise<void>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button size="sm" variant="ghost" title="Modifier" aria-label="Modifier" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    )
  }

  return (
    <div className="mt-2 w-full rounded-lg border bg-muted/30 p-3">
      <ActionForm
        action={async (formData) => {
          const result = await action(formData)
          if (!result?.error) {
            await onDone()
            setOpen(false)
          }
          return result
        }}
        className="flex flex-wrap items-end gap-3"
      >
        {children}
        <Button type="submit" size="sm">Enregistrer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </ActionForm>
    </div>
  )
}

export default function AcademicStructurePage() {
  const user = useSupabaseUser()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadYears = async () => {
    const res = await getAcademicYears()
    if (res.data) setAcademicYears(res.data)
  }
  const loadGradeLevels = async () => {
    const res = await getGradeLevels()
    if (res.data) setGradeLevels(res.data as GradeLevel[])
  }
  const loadClasses = async () => {
    const res = await getClasses()
    if (res.data) setClasses(res.data as ClassItem[])
  }
  const loadSubjects = async () => {
    const res = await getSubjects()
    if (res.data) setSubjects(res.data as Subject[])
  }
  const loadAssignments = async () => {
    const res = await getClassSubjectAssignments()
    if (res.data) setAssignments(res.data as Assignment[])
  }
  const loadTeachers = async () => {
    const res = await getTeachersForSchool()
    if (res.data) setTeachers(res.data)
  }

  // Activation d'année : un seul chemin (RPC atomique). Confirmation seulement
  // s'il faut clôturer l'année déjà en cours — sinon un clic suffit.
  const handleActivateYear = (yearId: string, yearLabel: string) => {
    const active = academicYears.find((y) => y.status === "en_cours")
    if (active) {
      const ok = window.confirm(
        `« ${active.label} » sera clôturée.\n« ${yearLabel} » devient l'année en cours (notes, appels, facturation).\n\nContinuer ?`
      )
      if (!ok) return
    }
    setActionError(null)
    startTransition(async () => {
      const res = await activateAcademicYear(yearId)
      if (res.error) { setActionError(res.error); return }
      await loadYears()
    })
  }

  const handleCreateSuggestedYear = () => {
    const win = computeAcademicWindow()
    const fd = new FormData()
    fd.set("label", win.label)
    fd.set("startDate", win.start_date)
    fd.set("endDate", win.end_date)
    setActionError(null)
    startTransition(async () => {
      const res = await createAcademicYear(fd)
      if (res?.error) { setActionError(res.error); return }
      await loadYears()
    })
  }

  useEffect(() => {
    if (!user) return
    void loadYears()
    void loadGradeLevels()
    void loadClasses()
    void loadSubjects()
    void loadAssignments()
    void loadTeachers()
  }, [user])

  const currentYear = academicYears.find(y => y.status === "en_cours")
  const plannedYear = academicYears.find(y => y.status === "planifiee")
  const suggestedYear = computeAcademicWindow()
  const [tab, setTab] = useState("years")

  const handleMissingYearCta = () => {
    setTab("years")
    if (plannedYear) {
      handleActivateYear(plannedYear.id, plannedYear.label)
      return
    }
    handleCreateSuggestedYear()
  }

  return (
    <div className="space-y-6">
      {!currentYear && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">Aucune année académique en cours</h3>
                <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                  {plannedYear
                    ? `Un clic active « ${plannedYear.label} » et débloque notes et appels.`
                    : `Un clic crée et active « ${suggestedYear.label} » (sept. → juil.).`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-200"
                disabled={isPending}
                onClick={handleMissingYearCta}
              >
                {isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : plannedYear
                    ? `Activer ${plannedYear.label}`
                    : `Créer ${suggestedYear.label}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentYear && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Année en cours : {currentYear.label}</h3>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Toutes les opérations pédagogiques et financières se réfèrent à cette année.
                </p>
              </div>
              <Badge className="bg-green-600 text-white">Active</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="years"><BookOpen className="h-4 w-4 mr-2" />Années</TabsTrigger>
          <TabsTrigger value="levels"><GraduationCap className="h-4 w-4 mr-2" />Niveaux</TabsTrigger>
          <TabsTrigger value="classes"><Users className="h-4 w-4 mr-2" />Classes</TabsTrigger>
          <TabsTrigger value="subjects"><FileText className="h-4 w-4 mr-2" />Matières</TabsTrigger>
          <TabsTrigger value="matrix"><BookOpen className="h-4 w-4 mr-2" />Matrice</TabsTrigger>
          <TabsTrigger value="rollover"><RotateCcw className="h-4 w-4 mr-2" />Bascule</TabsTrigger>
        </TabsList>

        <TabsContent value="years">
          <Card>
            <CardHeader>
              <CardTitle>Années académiques</CardTitle>
              <CardDescription>
                La première année est activée toute seule. Les suivantes restent planifiées jusqu&apos;au bouton Activer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={withReload(createAcademicYear, loadYears)} className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <Label htmlFor="label">Label</Label>
                  <Input name="label" defaultValue={suggestedYear.label} placeholder="Ex: 2025-2026" required className="max-w-[200px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startDate">Début</Label>
                  <Input name="startDate" type="date" defaultValue={suggestedYear.start_date} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">Fin</Label>
                  <Input name="endDate" type="date" defaultValue={suggestedYear.end_date} required />
                </div>
                {/* Pas de sélecteur de statut : la première année est activée
                    automatiquement ; les suivantes naissent « planifiées » et
                    passent en service via « Activer » (RPC atomique). */}
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>

              {actionError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              )}

              <div className="space-y-2">
                {academicYears.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune année. Utilisez le bandeau ci-dessus ou validez le formulaire déjà prérempli.
                  </p>
                )}
                {academicYears.map(year => (
                  <div key={year.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <p className="font-medium">{year.label}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={year.status === "en_cours" ? "default" : "secondary"}>
                        {year.status === "en_cours" ? "En cours" : year.status === "cloturee" ? "Clôturée" : "Planifiée"}
                      </Badge>
                      {year.status === "planifiee" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleActivateYear(year.id, year.label)}
                        >
                          {isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Play className="h-3.5 w-3.5" />}
                          <span className="ml-1">Activer</span>
                        </Button>
                      )}
                      <ArchiveButton
                        action={archiveAcademicYear}
                        id={year.id}
                        title="Archiver l'année"
                        confirmMessage={`Archiver l'année « ${year.label} » ? Elle disparaîtra des listes et de la bascule (l'historique des élèves est conservé).`}
                        onDone={loadYears}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels">
          <Card>
            <CardHeader>
              <CardTitle>Niveaux</CardTitle>
              <CardDescription>Définissez les niveaux de votre établissement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={withReload(createGradeLevel, loadGradeLevels)} className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Nom</Label>
                  <Input name="name" placeholder="Ex: 6ème" required className="max-w-[200px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="level">Niveau</Label>
                  <Input name="level" type="number" required className="max-w-[120px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cycle">Cycle</Label>
                  <Input name="cycle" placeholder="Collège" required className="max-w-[160px]" />
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              {/* La bascule d'année promeut au RANG SUPÉRIEUR (rang + 1) : le
                  rang doit donc croître avec l'avancement dans le cursus, et non
                  suivre le numéro de la classe (sinon tous les élèves du dernier
                  rang saisi seraient traités comme diplômés). */}
              <p className="text-xs text-muted-foreground">
                Le rang est un ordre <strong>croissant</strong> utilisé par la bascule d&apos;année :
                1 pour la première année de l&apos;établissement, puis 2, 3… jusqu&apos;au dernier
                rang (le plus élevé), qui est celui des élèves sortants.
              </p>
              <div className="space-y-2">
                {gradeLevels.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucun niveau. Le rang 1 est la première année de l&apos;établissement, puis 2, 3…
                  </p>
                )}
                {gradeLevels.map(level => (
                  <div key={level.id} className="flex flex-col rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{level.name}</p>
                        <p className="text-xs text-muted-foreground">Cycle: {level.cycle} · Rang: {level.level}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <InlineEdit action={updateGradeLevel} onDone={loadGradeLevels}>
                          <input type="hidden" name="id" value={level.id} />
                          <div className="space-y-1">
                            <Label htmlFor={`level-name-${level.id}`}>Nom</Label>
                            <Input id={`level-name-${level.id}`} name="name" defaultValue={level.name} required className="max-w-[160px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`level-rank-${level.id}`}>Rang</Label>
                            <Input id={`level-rank-${level.id}`} name="level" type="number" defaultValue={String(level.level)} required className="max-w-[110px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`level-cycle-${level.id}`}>Cycle</Label>
                            <Input id={`level-cycle-${level.id}`} name="cycle" defaultValue={level.cycle} required className="max-w-[160px]" />
                          </div>
                        </InlineEdit>
                        <ArchiveButton
                          action={archiveGradeLevel}
                          id={level.id}
                          title="Archiver le niveau"
                          confirmMessage={`Archiver le niveau « ${level.name} » ? (refusé s'il contient encore des classes)`}
                          onDone={loadGradeLevels}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <CardDescription>Créez les classes de votre établissement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={withReload(createClass, loadClasses)} className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <Label htmlFor="gradeLevelId">Niveau</Label>
                  <select name="gradeLevelId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Niveau</option>
                    {gradeLevels.map(level => (
                      <option key={level.id} value={level.id}>{level.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="name">Nom</Label>
                  <Input name="name" placeholder="Ex: 6ème A" required className="max-w-[180px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="capacity">Capacité</Label>
                  <Input name="capacity" type="number" className="max-w-[120px]" />
                </div>
                {/* Le champ existait côté action (head_teacher_id) mais aucun
                    formulaire ne l'alimentait : le titulaire de classe était
                    impossible à renseigner. */}
                <div className="space-y-1">
                  <Label htmlFor="headTeacherId">Titulaire</Label>
                  <select name="headTeacherId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">—</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              <div className="space-y-2">
                {classes.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune classe. Créez d&apos;abord un niveau, puis une classe (ex. 6ème A).
                  </p>
                )}
                {classes.map(cls => (
                  <div key={cls.id} className="flex flex-col rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{cls.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Niveau: {cls.grade_levels?.name} · Capacité: {cls.capacity ?? "—"}
                          {cls.users?.full_name ? ` · Titulaire: ${cls.users.full_name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <InlineEdit action={updateClass} onDone={loadClasses}>
                          <input type="hidden" name="id" value={cls.id} />
                          <div className="space-y-1">
                            <Label htmlFor={`class-name-${cls.id}`}>Nom</Label>
                            <Input id={`class-name-${cls.id}`} name="name" defaultValue={cls.name} required className="max-w-[160px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`class-capacity-${cls.id}`}>Capacité</Label>
                            <Input id={`class-capacity-${cls.id}`} name="capacity" type="number" defaultValue={cls.capacity === null ? "" : String(cls.capacity)} className="max-w-[110px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`class-teacher-${cls.id}`}>Titulaire</Label>
                            <select
                              id={`class-teacher-${cls.id}`}
                              name="headTeacherId"
                              defaultValue={cls.head_teacher_id ?? ""}
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              {teachers.map(teacher => (
                                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                              ))}
                            </select>
                          </div>
                        </InlineEdit>
                        <ArchiveButton
                          action={archiveClass}
                          id={cls.id}
                          title="Archiver la classe"
                          confirmMessage={`Archiver la classe « ${cls.name} » ? (refusé si des élèves y sont inscrits cette année ou si des matières y sont affectées)`}
                          onDone={loadClasses}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects">
          <Card>
            <CardHeader>
              <CardTitle>Matières</CardTitle>
              <CardDescription>Définissez les matières enseignées et leurs coefficients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={withReload(createSubject, loadSubjects)} className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Nom</Label>
                  <Input name="name" placeholder="Mathématiques" required className="max-w-[200px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="code">Code</Label>
                  <Input name="code" placeholder="MAT" className="max-w-[100px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coefficient">Coefficient</Label>
                  <Input name="coefficient" type="number" step="0.1" defaultValue="1" className="max-w-[100px]" />
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              <div className="space-y-2">
                {subjects.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune matière. Ajoutez les enseignements (Mathématiques, Français…) et leurs coefficients.
                  </p>
                )}
                {subjects.map(subject => (
                  <div key={subject.id} className="flex flex-col rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {subject.code || "—"} · Coef: {subject.coefficient}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <InlineEdit action={updateSubject} onDone={loadSubjects}>
                          <input type="hidden" name="id" value={subject.id} />
                          <div className="space-y-1">
                            <Label htmlFor={`subject-name-${subject.id}`}>Nom</Label>
                            <Input id={`subject-name-${subject.id}`} name="name" defaultValue={subject.name} required className="max-w-[180px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`subject-code-${subject.id}`}>Code</Label>
                            <Input id={`subject-code-${subject.id}`} name="code" defaultValue={subject.code ?? ""} className="max-w-[100px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`subject-coef-${subject.id}`}>Coefficient</Label>
                            <Input id={`subject-coef-${subject.id}`} name="coefficient" type="number" step="0.1" defaultValue={String(subject.coefficient)} className="max-w-[100px]" />
                          </div>
                        </InlineEdit>
                        <ArchiveButton
                          action={archiveSubject}
                          id={subject.id}
                          title="Archiver la matière"
                          confirmMessage={`Archiver la matière « ${subject.name} » ? (refusé si elle est encore affectée à une classe ; les notes passées sont conservées)`}
                          onDone={loadSubjects}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Matrice Classe × Matière</CardTitle>
              <CardDescription>Assignez les matières à chaque classe avec leur coefficient et professeur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={withReload(createClassSubjectAssignment, loadAssignments)} className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1">
                  <Label htmlFor="classId">Classe</Label>
                  <select name="classId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Classe</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="subjectId">Matière</Label>
                  <select name="subjectId" required className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Matière</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coefficient">Coefficient</Label>
                  <Input name="coefficient" type="number" step="0.1" defaultValue="1" className="max-w-[100px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="teacherId">Professeur</Label>
                  {/* Sélecteur auparavant figé sur une option vide : la liste
                      des enseignants de l'école n'était jamais chargée, toute
                      affectation de professeur était donc impossible. */}
                  <select name="teacherId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">—</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              {teachers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun professeur rattaché à l&apos;école : attribuez d&apos;abord le rôle
                  « professeur » à un utilisateur pour pouvoir l&apos;affecter à une matière.
                </p>
              )}
              <div className="space-y-2">
                {/* Tri d'affichage local (classe puis matière) : le tri ne peut
                    pas être demandé à PostgREST sur une ressource embarquée
                    sans risquer un 400 qui vidait la matrice. */}
                {assignments.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Matrice vide. Affectez une matière à une classe, avec son coefficient et son professeur.
                  </p>
                )}
                {assignments
                  .slice()
                  .sort(
                    (a, b) =>
                      (a.classes?.name ?? "").localeCompare(b.classes?.name ?? "", "fr") ||
                      (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? "", "fr"),
                  )
                  .map(assignment => (
                  <div key={assignment.id} className="flex flex-col rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{assignment.classes?.name} — {assignment.subjects?.name}</p>
                        <p className="text-xs text-muted-foreground">Coef: {assignment.coefficient} · Prof: {assignment.users?.full_name || "—"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <InlineEdit action={updateClassSubjectAssignment} onDone={loadAssignments}>
                          <input type="hidden" name="id" value={assignment.id} />
                          <div className="space-y-1">
                            <Label htmlFor={`assign-coef-${assignment.id}`}>Coefficient</Label>
                            <Input id={`assign-coef-${assignment.id}`} name="coefficient" type="number" step="0.1" defaultValue={String(assignment.coefficient)} className="max-w-[100px]" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`assign-teacher-${assignment.id}`}>Professeur</Label>
                            <select
                              id={`assign-teacher-${assignment.id}`}
                              name="teacherId"
                              defaultValue={assignment.teacher_id ?? ""}
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              {teachers.map(teacher => (
                                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                              ))}
                            </select>
                          </div>
                        </InlineEdit>
                        <ArchiveButton
                          action={archiveClassSubjectAssignment}
                          id={assignment.id}
                          title="Retirer l'affectation"
                          confirmMessage={`Retirer « ${assignment.subjects?.name} » de la classe ${assignment.classes?.name} ?`}
                          onDone={loadAssignments}
                        />
                      </div>
                    </div>
                  </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rollover">
          <YearRolloverPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
