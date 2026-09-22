// Panneau « Classes » — extrait de page.tsx : liste + création (modale,
// titulaire optionnel) + modification et archive par ligne.
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClass, updateClass, archiveClass } from "../actions"
import { withReload, CreateDialog, EditDialog, ArchiveButton } from "./dialogs"
import type { AcademicYear, ClassItem, GradeLevel, Teacher } from "./types"

export function ClassesPanel({
  classes,
  levels,
  teachers,
  years,
  currentYear,
  computedLabel,
  reload,
}: {
  classes: ClassItem[]
  levels: GradeLevel[]
  teachers: Teacher[]
  years: AcademicYear[]
  currentYear: AcademicYear | undefined
  computedLabel: string
  reload: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classes</CardTitle>
        <CardDescription>
          Année active : {currentYear?.label ?? computedLabel} — {classes.length} classe{classes.length > 1 ? "s" : ""} {years.length === 0 ? "— structure à initialiser" : "configurée(s)"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateDialog
          title="Nouvelle classe"
          description="Créez une classe rattachée à un niveau, avec un titulaire optionnel."
          triggerLabel="Nouvelle classe"
          action={withReload(createClass, reload)}
        >
          <div className="space-y-1">
            <Label htmlFor="class-name">Nom de la classe</Label>
            <Input id="class-name" name="name" placeholder="CP1 A" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="class-capacity">Capacité</Label>
            <Input id="class-capacity" name="capacity" type="number" min="1" placeholder="45" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="class-level">Niveau</Label>
            <select
              id="class-level"
              name="gradeLevelId"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Choisir un niveau</option>
              {levels.map(level => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="class-teacher">Titulaire (optionnel)</Label>
            <select
              id="class-teacher"
              name="headTeacherId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </select>
          </div>
        </CreateDialog>
        <div className="space-y-2">
          {classes.length === 0 && <p className="text-sm text-muted-foreground">Aucune classe pour le moment.</p>}
          {classes.map(classItem => (
            <div key={classItem.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
              <div>
                <p className="font-medium">{classItem.name}</p>
                <p className="text-xs text-muted-foreground">
                  {classItem.grade_levels?.name ?? "Sans niveau"} · {classItem.capacity ?? "—"} places
                  {classItem.users?.full_name ? ` · ${classItem.users.full_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <EditDialog
                  title={`Modifier ${classItem.name}`}
                  action={withReload(updateClass, reload)}
                  onDone={reload}
                >
                  <input type="hidden" name="id" value={classItem.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`class-name-${classItem.id}`}>Nom</Label>
                    <Input id={`class-name-${classItem.id}`} name="name" defaultValue={classItem.name} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`class-capacity-${classItem.id}`}>Capacité</Label>
                    <Input id={`class-capacity-${classItem.id}`} name="capacity" type="number" min="1" defaultValue={classItem.capacity ?? ""} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`class-teacher-${classItem.id}`}>Titulaire</Label>
                    <select
                      id={`class-teacher-${classItem.id}`}
                      name="headTeacherId"
                      defaultValue={classItem.head_teacher_id ?? ""}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                      ))}
                    </select>
                  </div>
                </EditDialog>
                <ArchiveButton
                  action={archiveClass}
                  id={classItem.id}
                  title="Archiver la classe"
                  confirmMessage={`Archiver « ${classItem.name} » ? Les élèves déjà inscrits restent rattachés.`}
                  onDone={reload}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
