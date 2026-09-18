"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { createMoratorium, getMoratoriumContext } from "@/app/dashboard/finance/moratoriums/actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"

/**
 * Modale « Nouvelle demande » : la page Moratoires ne montre que la liste,
 * le formulaire élève × motif × montant × échéance vit ici.
 */
export function AddMoratoriumModal({
  enrollments,
  onSuccess,
}: {
  enrollments: Array<{ id: string; matricule: string | null; label: string }>
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<{ balance: number; active: boolean } | null>(null)
  const [submitted, setSubmitted] = useState(0)

  async function handleSelect(enrollmentId: string) {
    if (!enrollmentId) {
      setContext(null)
      return
    }
    const result = await getMoratoriumContext(enrollmentId)
    if (result.error) {
      toast.error(result.error)
      setContext(null)
      return
    }
    setContext({
      balance: Number(result.data?.enrollment?.fee_balance ?? 0),
      active: Boolean(result.data?.active),
    })
  }

  async function handleSubmit(formData: FormData) {
    const result = await createMoratorium(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Demande enregistrée — en attente d'arbitrage par la direction.")
    setSubmitted((c) => c + 1)
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Nouvelle demande de moratoire">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Nouvelle demande de moratoire</DialogTitle>
          <DialogDescription>
            Délai de paiement accordé à une famille, arbitré ensuite par la direction.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleSubmit} key={submitted}>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="mor-enrollment">Élève *</Label>
                <select id="mor-enrollment" name="enrollmentId" required onChange={(e) => { void handleSelect(e.target.value) }} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Sélectionner</option>
                  {enrollments.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
              {context && (
                <p className={`text-xs rounded-md px-3 py-2 border ${context.active ? "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200" : "border-input bg-muted text-muted-foreground"}`}>
                  {context.active
                    ? "Un moratoire est déjà en cours pour cet élève."
                    : `Solde actuel de l'élève : ${context.balance.toLocaleString("fr-FR")} FCFA`}
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="mor-reason">Motif *</Label>
                <Input id="mor-reason" name="reason" required placeholder="Ex : difficultés temporaires…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mor-amount">Montant concerné *</Label>
                  <Input id="mor-amount" name="requestedAmount" type="number" min="1" required placeholder="Ex : 50000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mor-due">Date limite *</Label>
                  <Input id="mor-due" name="dueDate" type="date" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Soumettre</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
