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
import { Plus } from "lucide-react"
import { createFeeSchedule } from "@/app/dashboard/finance/actions"

type Option = { id: string; name: string }
type YearOption = { id: string; label: string }

/**
 * Modale « Nouveau tarif » : la page Finance ne montre que la grille,
 * le formulaire niveau × profil × année vit ici.
 */
export function AddFeeScheduleModal({
  profiles,
  gradeLevels,
  years,
}: {
  profiles: Option[]
  gradeLevels: Option[]
  years: YearOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Nouveau tarif
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Ajouter un tarif à la grille">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Ajouter un tarif</DialogTitle>
          <DialogDescription>
            Niveau × profil financier × année. Le profil « Standard » couvre les
            élèves sans profil particulier.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={createFeeSchedule}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fs-gradeLevelId">Niveau *</Label>
                <Select name="gradeLevelId" required>
                  <SelectTrigger id="fs-gradeLevelId" ariaLabel="Niveau">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-profileId">Profil financier</Label>
                <Select name="financialProfileId">
                  <SelectTrigger id="fs-profileId" ariaLabel="Profil financier">
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-yearId">Année académique *</Label>
                <Select name="academicYearId" required>
                  <SelectTrigger id="fs-yearId" ariaLabel="Année académique">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-amount">Montant (FCFA) *</Label>
                <Input id="fs-amount" name="amount" type="number" min="0" required placeholder="Ex : 150000" />
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <Label htmlFor="fs-label">Libellé (optionnel)</Label>
              <Input id="fs-label" name="label" placeholder="Ex : Scolarité annuelle" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Ajouter</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
