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
import { createAcademicDecision } from "./actions"
import { toast } from "sonner"
import { ClipboardCheck } from "lucide-react"

type YearOption = { id: string; label: string; status: string }

const DECISION_OPTIONS = [
  { value: "admitted", label: "Admis", styles: "border-green-500 bg-green-50 text-green-700" },
  { value: "repeated", label: "Redouble", styles: "border-orange-500 bg-orange-50 text-orange-700" },
  { value: "excluded", label: "Exclu", styles: "border-red-500 bg-red-50 text-red-700" },
  { value: "pending", label: "En attente", styles: "border-gray-300 bg-gray-50 text-gray-600" },
]

/**
 * Modale « Enregistrer une décision » (conseil de classe) : l'onglet ne
 * montre que la liste des décisions ; l'acte de direction vit ici.
 */
export function CreateDecisionModal({
  students,
  years,
  currentYearId,
  onSuccess,
}: {
  students: Array<{ id: string; label: string }>
  years: YearOption[]
  currentYearId?: string
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(0)

  async function handleSubmit(formData: FormData) {
    const result = await createAcademicDecision(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Décision enregistrée.")
    setSubmitted((c) => c + 1)
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <ClipboardCheck className="h-4 w-4 mr-2" /> Enregistrer une décision
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Enregistrer une décision du conseil de classe">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Enregistrer une décision</DialogTitle>
          <DialogDescription>
            Admission, redoublement ou exclusion — acte réservé à la direction.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleSubmit} key={submitted}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Décision *</Label>
                <div className="flex gap-2">
                  {DECISION_OPTIONS.map((d) => (
                    <label key={d.value} className="flex-1 cursor-pointer">
                      <input type="radio" name="decision" value={d.value} className="sr-only" />
                      <div className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-colors ${d.styles}`}>
                        {d.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="dec-enrollmentId">Élève *</Label>
                <Select id="dec-enrollmentId" name="enrollmentId" required>
                  <option value="">Sélectionner un élève</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dec-yearId">Année académique *</Label>
                <Select id="dec-yearId" name="academicYearId" required defaultValue={currentYearId}>
                  <option value="">Sélectionner</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dec-average">Moyenne générale (optionnel)</Label>
                <Input id="dec-average" name="average" type="number" step="0.01" min="0" max="20" placeholder="Ex : 12.50" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="dec-observations">Observations</Label>
                <textarea
                  id="dec-observations"
                  name="observations"
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Observations du conseil de classe..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <ClipboardCheck className="h-4 w-4 mr-2" /> Enregistrer la décision
              </Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
