"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Copy } from "lucide-react"
import { duplicateFeeSchedule } from "@/app/dashboard/finance/actions"

type YearOption = { id: string; label: string }

/**
 * Modale « Dupliquer la grille » : année source → année cible, en 1 clic.
 */
export function DuplicateFeeScheduleModal({ years }: { years: YearOption[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handleDuplicate(formData: FormData) {
    await startTransition(async () => {
      const result = await duplicateFeeSchedule(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      const data = result?.data as { copied: number; skipped: number } | undefined
      toast.success(
        `Grille dupliquée : ${data?.copied ?? 0} ligne(s) copiée(s)${data?.skipped ? `, ${data.skipped} déjà présente(s) ignorée(s)` : ""}.`
      )
      setOpen(false)
    })
  }

  if (years.length < 2) return null

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={pending}>
        <Copy className="h-4 w-4 mr-2" /> Dupliquer la grille
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Dupliquer la grille tarifaire">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Dupliquer la grille</DialogTitle>
          <DialogDescription>
            Copie tous les tarifs d&apos;une année vers une autre. Les lignes
            déjà présentes sont ignorées.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleDuplicate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dup-sourceYearId">Année source *</Label>
                <Select name="sourceYearId" required>
                  <SelectTrigger id="dup-sourceYearId" ariaLabel="Année source">
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
                <Label htmlFor="dup-targetYearId">Année cible *</Label>
                <Select name="targetYearId" required>
                  <SelectTrigger id="dup-targetYearId" ariaLabel="Année cible">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="secondary" disabled={pending}>Dupliquer</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
