"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { createPayment } from "@/app/dashboard/finance/actions"
import { toast } from "sonner"
import { Wallet } from "lucide-react"

export type PayModalEnrollment = {
  id: string
  matricule: string | null
  students: { first_name: string; last_name: string }
}

/**
 * Modale d'encaissement : la page Caisse ne montre que recherche + solde,
 * tout le formulaire (montant / mode / référence / avance) vit ici.
 */
export function PayModal({
  enrollment,
  balance,
  hasFeeItems,
  defaultAmount,
  onSuccess,
}: {
  enrollment: PayModalEnrollment
  balance: number
  hasFeeItems: boolean
  defaultAmount: string
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState("")
  const [paidCount, setPaidCount] = useState(0)

  async function handlePay(formData: FormData) {
    const result = await createPayment(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Paiement encaissé — le reçu est disponible dans l'historique.")
    setPaidCount((c) => c + 1)
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4 mr-2" /> Encaisser
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        label={`Encaisser ${enrollment.students?.first_name} ${enrollment.students?.last_name}`}
      >
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>
            Encaisser — {enrollment.students?.last_name} {enrollment.students?.first_name}
          </DialogTitle>
          <DialogDescription>
            {hasFeeItems
              ? `Reste à payer : ${balance.toLocaleString("fr-FR")} FCFA.`
              : "Sans échéancier : montant libre."}
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handlePay} key={`${enrollment.id}-${defaultAmount}-${paidCount}`}>
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pay-amount">Montant (FCFA)</Label>
                <Input
                  id="pay-amount"
                  name="amount"
                  type="number"
                  min="1"
                  required
                  defaultValue={defaultAmount}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-method">Mode de paiement</Label>
                <Select value={method} onValueChange={setMethod} name="paymentMethod">
                  <SelectTrigger id="pay-method">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                    <SelectItem value="transfer">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {method !== "cash" && method !== "" && (
                <div className="space-y-1">
                  <Label htmlFor="pay-reference">
                    {method === "check"
                      ? "N° de chèque *"
                      : method === "mobile_money"
                        ? "N° de transaction (optionnel)"
                        : "Référence du virement (optionnel)"}
                  </Label>
                  <Input
                    id="pay-reference"
                    name="reference"
                    required={method === "check"}
                    placeholder={
                      method === "check"
                        ? "Numéro figurant sur le chèque"
                        : "Optionnel — pour le rapprochement"
                    }
                  />
                </div>
              )}
              {hasFeeItems && balance > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="allowOverpay" className="mt-1" />
                  <span>Enregistrer comme avance volontaire (montant supérieur au solde)</span>
                </label>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <Wallet className="h-4 w-4 mr-2" /> Encaisser
              </Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
