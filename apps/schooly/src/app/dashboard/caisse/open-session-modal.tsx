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
import { openCashSession } from "@/app/dashboard/finance/actions"
import { toast } from "sonner"
import { Wallet } from "lucide-react"

/**
 * Modale d'ouverture de session de caisse : la page Clôture ne montre que
 * le statut + l'historique, le fond de caisse se saisit ici.
 */
export function OpenSessionModal({ onOpened }: { onOpened?: () => void }) {
  const [open, setOpen] = useState(false)

  async function handleOpen(formData: FormData) {
    const result = await openCashSession(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Session de caisse ouverte.")
    setOpen(false)
    onOpened?.()
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4 mr-2" /> Ouvrir une session
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Ouvrir une session de caisse">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Ouvrir une session de caisse</DialogTitle>
          <DialogDescription>
            Le fond de caisse initial. Une seule session ouverte à la fois.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleOpen}>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="open-amount">Fond de caisse (FCFA)</Label>
                <Input
                  id="open-amount"
                  name="openingAmount"
                  type="number"
                  min="0"
                  required
                  defaultValue="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Ouvrir</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
