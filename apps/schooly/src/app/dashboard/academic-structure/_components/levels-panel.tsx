// Panneau « Niveaux » — extrait de page.tsx : liste + création (modale) +
// modification et archive par ligne. Inchangé fonctionnellement.
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGradeLevel, updateGradeLevel, archiveGradeLevel } from "../actions"
import { withReload, CreateDialog, EditDialog, ArchiveButton } from "./dialogs"
import type { AcademicYear, GradeLevel } from "./types"

export function LevelsPanel({
  levels,
  years,
  currentYear,
  computedLabel,
  reload,
}: {
  levels: GradeLevel[]
  years: AcademicYear[]
  currentYear: AcademicYear | undefined
  computedLabel: string
  reload: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Niveaux scolaires</CardTitle>
        <CardDescription>
          Année active : {currentYear?.label ?? computedLabel} — structure {years.length === 0 ? "à initialiser" : "active"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateDialog
          title="Nouveau niveau"
          description="Ajoutez un niveau (ex. CP1) rattaché à un cycle."
          triggerLabel="Nouveau niveau"
          action={withReload(createGradeLevel, reload)}
        >
          <div className="space-y-1">
            <Label htmlFor="level-name">Nom</Label>
            <Input id="level-name" name="name" placeholder="CP1" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="level-order">Ordre</Label>
            <Input id="level-order" name="level" type="number" min="1" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="level-cycle">Cycle</Label>
            <select
              id="level-cycle"
              name="cycle"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="préscolaire">Préscolaire</option>
              <option value="primaire">Primaire</option>
              <option value="collège">Collège</option>
              <option value="lycée">Lycée</option>
            </select>
          </div>
        </CreateDialog>
        <div className="space-y-2">
          {levels.length === 0 && <p className="text-sm text-muted-foreground">Aucun niveau pour le moment.</p>}
          {levels.map(level => (
            <div key={level.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
              <div>
                <p className="font-medium">{level.name}</p>
                <p className="text-xs text-muted-foreground">Ordre {level.level} — {level.cycle}</p>
              </div>
              <div className="flex items-center gap-1">
                <EditDialog
                  title={`Modifier ${level.name}`}
                  action={withReload(updateGradeLevel, reload)}
                  onDone={reload}
                >
                  <input type="hidden" name="id" value={level.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`level-name-${level.id}`}>Nom</Label>
                    <Input id={`level-name-${level.id}`} name="name" defaultValue={level.name} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`level-order-${level.id}`}>Ordre</Label>
                    <Input id={`level-order-${level.id}`} name="level" type="number" min="1" defaultValue={level.level} required />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`level-cycle-${level.id}`}>Cycle</Label>
                    <select
                      id={`level-cycle-${level.id}`}
                      name="cycle"
                      defaultValue={level.cycle}
                      required
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="préscolaire">Préscolaire</option>
                      <option value="primaire">Primaire</option>
                      <option value="collège">Collège</option>
                      <option value="lycée">Lycée</option>
                    </select>
                  </div>
                </EditDialog>
                <ArchiveButton
                  action={archiveGradeLevel}
                  id={level.id}
                  title="Archiver le niveau"
                  confirmMessage={`Archiver « ${level.name} » ainsi que ses classes ?`}
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
