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
import { applySiblingDiscounts } from "@/app/dashboard/finance/actions"
import { SIBLING_DEFAULT_RATE } from "@/lib/discounts"
import { Users } from "lucide-react"

/**
 * Modale « Remises fratrie » : la page Finance ne montre que le bouton,
 * le taux appliqué par l'établissement se saisit ici.
 */
export function SiblingDiscountModal({ academicYearId }: { academicYearId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4 mr-2" /> Appliquer les remises fratrie
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Appliquer les remises fratrie">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Remises fratrie</DialogTitle>
          <DialogDescription>
            Détecte les parents de 2+ enfants et applique la remise au 2e et
            suivants (par matricule). Idempotent. Aucun taux n&apos;est imposé :
            toutes les écoles ne pratiquent pas la remise fratrie.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={applySiblingDiscounts}>
            <input type="hidden" name="academicYearId" value={academicYearId} />
            <div className="space-y-1">
              <Label htmlFor="siblingRate">Taux appliqué par l&apos;établissement (%)</Label>
              <Input
                id="siblingRate"
                name="rate"
                type="number"
                min="1"
                max="50"
                required
                placeholder={String(SIBLING_DEFAULT_RATE)}
                className="w-28"
                aria-describedby="siblingRateHint"
              />
              <p id="siblingRateHint" className="text-xs text-muted-foreground">
                À saisir à chaque application (1 à 50 %). Laisser vide = aucune remise.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="secondary">Appliquer</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
