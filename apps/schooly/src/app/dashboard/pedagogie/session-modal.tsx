"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ActionForm } from "@/components/action-form"
import { createCourseSession } from "./actions"
import { toast } from "sonner"
import { CalendarPlus } from "lucide-react"

type Option = { id: string; name: string }
type TeacherOption = { id: string; full_name: string }
type YearOption = { id: string; label: string; status: string }

/**
 * Modale « Planifier un cours » : l'onglet Cours & Appels ne montre que le
 * planning ; les 7 champs de planification vivent ici.
 */
export function CreateSessionModal({
  classes,
  subjects,
  teachers,
  years,
  currentYearId,
  defaultTeacherId,
  onSuccess,
}: {
  classes: Option[]
  subjects: Option[]
  teachers: TeacherOption[]
  years: YearOption[]
  currentYearId?: string
  defaultTeacherId?: string
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(0)

  async function handleSubmit(formData: FormData) {
    const result = await createCourseSession(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Cours planifié.")
    setSubmitted((c) => c + 1)
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4 mr-2" /> Planifier un cours
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Planifier une session de cours">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Planifier une session de cours</DialogTitle>
          <DialogDescription>
            Classe, matière, professeur, horaires — le cours apparaît ensuite dans le planning.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleSubmit} key={submitted}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sess-classId">Classe *</Label>
                <Select id="sess-classId" name="classId" required>
                  <option value="">Sélectionner</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sess-subjectId">Matière *</Label>
                <Select id="sess-subjectId" name="subjectId" required>
                  <option value="">Sélectionner</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sess-teacherId">Professeur *</Label>
                <Select id="sess-teacherId" name="teacherId" required defaultValue={defaultTeacherId}>
                  <option value="">Sélectionner</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sess-yearId">Année académique *</Label>
                <Select id="sess-yearId" name="academicYearId" required defaultValue={currentYearId}>
                  <option value="">Sélectionner</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sess-startsAt">Heure de début *</Label>
                <Input id="sess-startsAt" name="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sess-endsAt">Heure de fin *</Label>
                <Input id="sess-endsAt" name="endsAt" type="datetime-local" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="sess-room">Salle (optionnel)</Label>
                <Input id="sess-room" name="room" placeholder="Ex : Salle 101" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <CalendarPlus className="h-4 w-4 mr-2" /> Planifier
              </Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
