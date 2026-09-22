"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionForm } from "@/components/action-form"
import { useState, useEffect, useCallback } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import {
  createClassSubjectAssignment,
  updateClassSubjectAssignment,
  archiveClassSubjectAssignment,
  getClassSubjectAssignments,
  getClasses,
  getSubjects,
  getTeachersForSchool,
} from "../actions"
import { withReload, CreateDialog, EditDialog, ArchiveButton } from "../_components/dialogs"
import type { ClassItem, Subject, Assignment, Teacher } from "../_components/types"

export interface MatrixTabProps {
  assignments: Assignment[]
  classes: ClassItem[]
  subjects: Subject[]
  teachers: Teacher[]
  reload: () => Promise<void>
  mutateAssignments: (
    formData: FormData,
  ) => Promise<{ error?: string; data?: unknown } | void>
}

/**
 * Matrice Classe × Matière — onglet latéral de structure académique.
 *
 * Découpé en sous-page (App Router) pour faire du *matrix* une préoccupation
 * secondaire : il n'est chargé que si l'utilisateur y accède. La page racine
 * `page.tsx` fournit l'état (assignments, classes, …) déjà chargé ; ce
 * composant est purement présentiel.
 *
 * @see tabs/page.test.tsx — la matrice "ne s'affiche pas au montage".
  */

export function MatrixTab({
  assignments,
  classes,
  subjects,
  teachers,
  reload,
  mutateAssignments,
}: MatrixTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Matrice Classe × Matière</CardTitle>
        <CardDescription>
          Assignez les matières à chaque classe avec leur coefficient et professeur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateDialog
          title="Affecter une matière"
          description="Classe, matière, coefficient et professeur responsable."
          triggerLabel="Nouvelle affectation"
          action={mutateAssignments}
        >
          <div className="space-y-1">
            <Label htmlFor="assign-class">Classe</Label>
            <select
              id="assign-class"
              name="classId"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Classe</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-subject">Matière</Label>
            <select
              id="assign-subject"
              name="subjectId"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Matière</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-coef">Coefficient</Label>
            <Input id="assign-coef" name="coefficient" type="number" step="0.1" defaultValue="1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-teacher">Professeur</Label>
            <select
              id="assign-teacher"
              name="teacherId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </div>
                </CreateDialog>
        {teachers.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Aucun professeur rattaché à l&apos;école : attribuez d&apos;abord le rôle
            « professeur » à un utilisateur pour pouvoir l&apos;affecter à une matière.
          </p>
        )}
        <div className="space-y-2">
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
            .map((assignment) => (
              <div key={assignment.id} className="flex flex-col rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {assignment.classes?.name} — {assignment.subjects?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Coef: {assignment.coefficient} · Prof: {assignment.users?.full_name || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditDialog
                      title={`Modifier ${assignment.subjects?.name ?? "affectation"}`}
                      action={updateClassSubjectAssignment}
                      onDone={reload}
                    >
                      <input type="hidden" name="id" value={assignment.id} />
                      <div className="space-y-1">
                        <Label htmlFor={`assign-coef-${assignment.id}`}>Coefficient</Label>
                        <Input
                          id={`assign-coef-${assignment.id}`}
                          name="coefficient"
                          type="number"
                          step="0.1"
                          defaultValue={String(assignment.coefficient)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`assign-teacher-${assignment.id}`}>Professeur</Label>
                        <select
                          id={`assign-teacher-${assignment.id}`}
                          name="teacherId"
                          defaultValue={assignment.teacher_id ?? ""}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">—</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </EditDialog>
                    <ArchiveButton
                      action={archiveClassSubjectAssignment}
                      id={assignment.id}
                      title="Retirer l'affectation"
                      confirmMessage={`Retirer « ${assignment.subjects?.name} » de la classe ${assignment.classes?.name} ?`}
                      onDone={reload}
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Enveloppe autonome : charge les données et expose un `reload`, sur le
// même modèle que years/page.tsx. C'est elle qui est chargée en lazy par
// le hub tabs — MatrixTab reste purement présentationnel et testable.
export default function MatrixPage() {
  const user = useSupabaseUser()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])

  const reload = useCallback(async () => {
    const [a, c, s, t] = await Promise.all([
      getClassSubjectAssignments(),
      getClasses(),
      getSubjects(),
      getTeachersForSchool(),
    ])
    if (a.data) setAssignments(a.data)
    if (c.data) setClasses(c.data)
    if (s.data) setSubjects(s.data)
    if (t.data) setTeachers(t.data)
  }, [])

  useEffect(() => {
    if (user) void reload()
  }, [user, reload])

  return (
    <MatrixTab
      assignments={assignments}
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      reload={reload}
      mutateAssignments={withReload(createClassSubjectAssignment, reload)}
    />
  )
}


