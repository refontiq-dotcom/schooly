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
import { createHomework } from "./actions"
import { toast } from "sonner"
import { BookPlus } from "lucide-react"

type Option = { id: string; name: string }

/**
 * Modale « Ajouter un devoir » : l'onglet Cahier de texte ne montre que la
 * liste ; titre, matière, échéance et consignes vivent ici.
 */
export function CreateHomeworkModal({
  classes,
  subjects,
  onSuccess,
}: {
  classes: Option[]
  subjects: Option[]
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(0)

  async function handleSubmit(formData: FormData) {
    const result = await createHomework(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Devoir créé (brouillon — publiez-le quand il est prêt).")
    setSubmitted((c) => c + 1)
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <BookPlus className="h-4 w-4 mr-2" /> Ajouter un devoir
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Ajouter un devoir">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Ajouter un devoir</DialogTitle>
          <DialogDescription>
            Créé en brouillon : il n&apos;est visible par les élèves qu&apos;après publication.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleSubmit} key={submitted}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="hw-classId">Classe *</Label>
                <Select id="hw-classId" name="classId" required>
                  <option value="">Sélectionner</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="hw-subjectId">Matière *</Label>
                <Select id="hw-subjectId" name="subjectId" required>
                  <option value="">Sélectionner</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hw-title">Titre du devoir *</Label>
                <Input id="hw-title" name="title" placeholder="Ex : Exercices sur les fractions" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hw-dueDate">Date d&apos;échéance *</Label>
                <Input id="hw-dueDate" name="dueDate" type="date" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="hw-description">Description (optionnel)</Label>
                <textarea
                  id="hw-description"
                  name="description"
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Instructions détaillées pour les élèves..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <BookPlus className="h-4 w-4 mr-2" /> Créer le devoir
              </Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
