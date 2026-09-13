"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, BookOpen, GraduationCap, Users, FileText, RotateCcw } from "lucide-react"
import { YearRolloverPanel } from "./year-rollover-panel"
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
} from "./actions"
import { ActionForm } from "@/components/action-form"
import { useSupabaseUser } from "@/hooks/use-supabase-user"

type AcademicYear = { id: string; label: string; status: string }
type GradeLevel = { id: string; name: string; level: number; cycle: string }
type ClassItem = { id: string; name: string; capacity: number | null; grade_levels?: { name: string } }
type Subject = { id: string; name: string; code: string | null; coefficient: number }
type Assignment = { id: string; classes?: { name: string }; subjects?: { name: string }; coefficient: number; users?: { full_name: string } }

export default function AcademicStructurePage() {
  const user = useSupabaseUser()

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])

  useEffect(() => {
    if (!user) return
    getAcademicYears().then(res => { if (res.data) setAcademicYears(res.data) })
    getGradeLevels().then(res => { if (res.data) setGradeLevels(res.data) })
    getClasses().then(res => { if (res.data) setClasses(res.data) })
    getSubjects().then(res => { if (res.data) setSubjects(res.data) })
    getClassSubjectAssignments().then(res => { if (res.data) setAssignments(res.data) })
  }, [user])

  const currentYear = academicYears.find(y => y.status === "en_cours")
  const [tab, setTab] = useState("years")

  return (
    <div className="space-y-6">
      {!currentYear && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">Aucune année académique en cours</h3>
                <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                  Créez une année académique et passez-la en "En cours" pour activer la saisie des notes et l'appel.
                </p>
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-300">Configuration requise</Badge>
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
              <CardDescription>Gérez les années scolaires de votre établissement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm action={createAcademicYear} className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="label">Label</Label>
                  <Input name="label" placeholder="Ex: 2025-2026" required className="max-w-[200px]" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startDate">Début</Label>
                  <Input name="startDate" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">Fin</Label>
                  <Input name="endDate" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status">Statut</Label>
                  <select name="status" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="planifiee">Planifiée</option>
                    <option value="en_cours">En cours</option>
                    <option value="cloturee">Clôturée</option>
                  </select>
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              <div className="space-y-2">
                {academicYears.map(year => (
                  <div key={year.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <p className="font-medium">{year.label}</p>
                    <Badge variant={year.status === "en_cours" ? "default" : "secondary"}>
                      {year.status === "en_cours" ? "En cours" : year.status === "cloturee" ? "Clôturée" : "Planifiée"}
                    </Badge>
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
              <ActionForm action={createGradeLevel} className="flex gap-3 items-end">
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
              <div className="space-y-2">
                {gradeLevels.map(level => (
                  <div key={level.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{level.name}</p>
                      <p className="text-xs text-muted-foreground">Cycle: {level.cycle} · Niveau: {level.level}</p>
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
              <ActionForm action={createClass} className="flex gap-3 items-end flex-wrap">
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
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              <div className="space-y-2">
                {classes.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">Niveau: {cls.grade_levels?.name} · Capacité: {cls.capacity ?? "—"}</p>
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
              <ActionForm action={createSubject} className="flex gap-3 items-end">
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
                {subjects.map(subject => (
                  <div key={subject.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {subject.code || "—"} · Coef: {subject.coefficient}</p>
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
              <ActionForm action={createClassSubjectAssignment} className="flex gap-3 items-end flex-wrap">
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
                  <select name="teacherId" className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">—</option>
                  </select>
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </ActionForm>
              <div className="space-y-2">
                {assignments.map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{assignment.classes?.name} — {assignment.subjects?.name}</p>
                      <p className="text-xs text-muted-foreground">Coef: {assignment.coefficient} · Prof: {assignment.users?.full_name || "—"}</p>
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
