"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  GraduationCap,
  BookOpen,
  Plus,
  TrendingUp,
  FileText,
  AlertCircle,
  Calculator,
} from "lucide-react"
import { ActionForm } from "@/components/action-form"
import {
  getGradeEntries,
  createGradeEntry,
  getClassesForSchool,
  getSubjectsForSchool,
  getEnrollmentsForSchool,
  getAcademicYearsForSchool,
} from "../actions"
import { useSupabaseUser } from "@/hooks/use-supabase-user"

type GradeEntry = {
  id: string
  grade_type: string
  label: string
  value: number
  max_value: number
  weight: number
  comment: string | null
  created_at: string
  users: { full_name: string } | null
  enrollments: {
    students: { first_name: string; last_name: string } | null
    classes: { name: string } | null
  } | null
  subjects: { name: string } | null
}

export default function GradesPage() {
  const user = useSupabaseUser()
  const [grades, setGrades] = useState<GradeEntry[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<{ id: string; label: string; status: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const currentYear = academicYears.find(y => y.status === "en_cours")

  useEffect(() => {
    if (!user) return
    
    const loadData = async () => {
      setLoading(true)
      
      const gradesRes = await getGradeEntries()
      if (gradesRes.data) setGrades(gradesRes.data)

      const classesRes = await getClassesForSchool()
      if (classesRes.data) setClasses(classesRes.data)

      const subjectsRes = await getSubjectsForSchool()
      if (subjectsRes.data) setSubjects(subjectsRes.data)

      const enrollmentsRes = await getEnrollmentsForSchool()
      if (enrollmentsRes.data) {
        // Formater les enrollments pour les afficher correctement
        setEnrollments(enrollmentsRes.data.map(e => ({
          id: e.id,
          name: `${e.students?.first_name} ${e.students?.last_name}`,
          class: e.classes?.name,
        })))
      }

      const yearsRes = await getAcademicYearsForSchool()
      if (yearsRes.data) setAcademicYears(yearsRes.data)

      setLoading(false)
    }

    loadData()
  }, [user])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "devoir": return <BookOpen className="h-4 w-4" />
      case "controle": return <FileText className="h-4 w-4" />
      case "interrogation": return <AlertCircle className="h-4 w-4" />
      case "project": return <TrendingUp className="h-4 w-4" />
      default: return <GraduationCap className="h-4 w-4" />
    }
  }

  const getGradeColor = (value: number, maxValue: number = 20) => {
    const ratio = value / maxValue
    if (ratio >= 15/20) return "text-green-600 dark:text-green-400"
    if (ratio >= 10/20) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }

  const getGradeBg = (value: number, maxValue: number = 20) => {
    const ratio = value / maxValue
    if (ratio >= 15/20) return "bg-green-100 dark:bg-green-900/30"
    if (ratio >= 10/20) return "bg-orange-100 dark:bg-orange-900/30"
    return "bg-red-100 dark:bg-red-900/30"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold tracking-tight">Saisie de notes</h1>
          <p className="text-muted-foreground">
            Enregistrez les notes de vos élèves pour chaque évaluation.
          </p>
        </div>
        {(user?.role === "professeur" || user?.role === "direction") && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Annuler" : "Nouvelle note"}
          </Button>
        )}
      </div>

      {/* Formulaire d'ajout de note */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Ajouter une note
            </CardTitle>
            <CardDescription>Enregistrez une nouvelle évaluation pour vos élèves.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={async (formData: FormData) => {
              // Server action via direct form submission
              const enrollmentId = formData.get("enrollmentId") as string
              const subjectId = formData.get("subjectId") as string
              const academicYearId = formData.get("academicYearId") as string
              const gradeType = formData.get("gradeType") as string
              const label = formData.get("label") as string
              const value = parseFloat(formData.get("value") as string)
              const maxValue = parseFloat(formData.get("maxValue") as string) || 20
              const weight = parseFloat(formData.get("weight") as string) || 1
              const comment = formData.get("comment") as string

              // Appel direct à l'API
              const response = await fetch("/api/grades/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  enrollmentId,
                  subjectId,
                  academicYearId,
                  gradeType,
                  label,
                  value,
                  maxValue,
                  weight,
                  comment,
                }),
              })

              if (response.ok) {
                setShowForm(false)
                window.location.reload()
              }
            }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="studentId">Élève</Label>
                <Select id="studentId" name="enrollmentId" required>
                  <option value="">Sélectionner un élève</option>
                  {enrollments.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.class && ` — ${e.class}`}
                    </option>
                  ))}
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
                <Label htmlFor="gradeType">Type d'évaluation</Label>
                <Select id="gradeType" name="gradeType" required>
                  <option value="devoir">Devoir</option>
                  <option value="controle">Contrôle</option>
                  <option value="interrogation">Interrogation</option>
                  <option value="project">Projet</option>
                  <option value="other">Autre</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="label">Intitulé</Label>
                <Input id="label" name="label" placeholder="Ex: DS1 - Chapitre 3" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="value">Note obtenue / 20</Label>
                <Input id="value" name="value" type="number" step="0.25" min="0" max="20" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="weight">Coefficient</Label>
                <Input id="weight" name="weight" type="number" min="0" step="0.5" defaultValue="1" />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="comment">Commentaire (optionnel)</Label>
                <textarea
                  id="comment"
                  name="comment"
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Commentaires pour l'élève..."
                />
              </div>
              <Button type="submit" className="lg:col-span-3">
                <Plus className="h-4 w-4 mr-2" />Enregistrer la note
              </Button>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {/* Liste des notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Historique des notes
          </CardTitle>
          <CardDescription>Toutes les notes saisies pour vos cours.</CardDescription>
        </CardHeader>
        <CardContent>
          {grades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucune note enregistrée</p>
              <p className="text-sm">
                {showForm
                  ? "Le formulaire est ouvert, remplissez-le pour ajouter votre première note."
                  : "Cliquez sur 'Nouvelle note' pour commencer."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {grades.map(grade => (
                <div
                  key={grade.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className={getGradeBg(grade.value, grade.max_value)}>
                      {getTypeIcon(grade.grade_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{grade.subjects?.name}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {grade.grade_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {grade.enrollments?.students?.first_name} {grade.enrollments?.students?.last_name}
                        {grade.enrollments?.classes?.name && ` — ${grade.enrollments.classes.name}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{grade.label}</p>
                      {grade.comment && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          "{grade.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getGradeColor(grade.value, grade.max_value)}`}>
                      {grade.value.toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">/ {grade.max_value}</span>
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-muted-foreground">
                        Coef: {grade.weight}x
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDate(grade.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section calcul des moyennes */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Moyennes par élève
          </CardTitle>
          <CardDescription>Calcul automatique des moyennes pondérées pour chaque élève.</CardDescription>
        </CardHeader>
        <CardContent>
          {!currentYear ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Sélectionnez une année académique en cours pour voir les moyennes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Élève</th>
                    <th className="text-left py-2 px-4 font-medium">Classe</th>
                    <th className="text-center py-2 px-4 font-medium">Moyenne générale</th>
                    <th className="text-center py-2 px-4 font-medium">Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => {
                    // Filtrer les notes pour cet élève
                    const studentGrades = grades.filter(
                      g => (g.enrollments as any)?.id === enrollment.id
                    )

                    // Calculer la moyenne pondérée
                    let weightedSum = 0
                    let totalWeight = 0

                    studentGrades.forEach(g => {
                      const normalizedValue = (g.value / g.max_value) * 20
                      weightedSum += normalizedValue * g.weight
                      totalWeight += g.weight
                    })

                    const average = totalWeight > 0 ? weightedSum / totalWeight : 0

                    const getAppreciation = (avg: number) => {
                      if (avg >= 16) return "Très bien"
                      if (avg >= 14) return "Bien"
                      if (avg >= 12) return "Assez bien"
                      if (avg >= 10) return "Passable"
                      return "Insuffisant"
                    }

                    return (
                      <tr key={enrollment.id} className="border-b last:border-0">
                        <td className="py-3 px-4">
                          <span className="font-medium">{enrollment.name}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {enrollment.class || "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-lg font-bold ${getGradeColor(average)}`}>
                            {average.toFixed(2)}/20
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className={`capitalize ${average >= 10 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {getAppreciation(average)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {enrollments.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Aucun élève inscrit dans cette classe.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note: les bulletins PDF seront générés depuis cette page plus tard */}
      <Card className="border-dashed border-2 border-border bg-card/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Génération de bulletins PDF</h3>
                <p className="text-sm text-muted-foreground">
                  Fonctionnalité disponible prochainement : génération automatique des bulletins de notes au format PDF.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Phase 6 - À compléter
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
