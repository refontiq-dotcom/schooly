// Panneau « Années » — extrait de page.tsx : la page parente fournit l'état
// chargé (années) et le callback d'activation ; les mutations rechargent via
// withReload comme avant.
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Play, Plus, Loader2 } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { createAcademicYear, archiveAcademicYear } from "../actions"
import { activateAcademicYear } from "../rollover-actions"
import { withReload, CreateDialog, ArchiveButton } from "./dialogs"
import type { AcademicYear } from "./types"

export function YearsPanel({
  years,
  currentYear,
  computedLabel,
  reload,
}: {
  years: AcademicYear[]
  currentYear: AcademicYear | undefined
  computedLabel: string
  reload: () => Promise<void>
}) {
  const [activateTarget, setActivateTarget] = useState<AcademicYear | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  /** Basculer l'année en cours via le server action dédié (cf. page.tsx). */
  function runActivateYear(id: string) {
    setActionError(null)
    startTransition(async () => {
      const res = await activateAcademicYear(id)
      if (res?.error) {
        setActionError(res.error)
        return
      }
      setActivateTarget(null)
      await reload()
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Années scolaires</CardTitle>
          <CardDescription>
            Période active : {currentYear?.label ?? computedLabel} — seule une année peut être en cours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreateDialog
            title="Nouvelle année scolaire"
            description="Créez une année puis activez-la pour en faire la période courante."
            triggerLabel="Nouvelle année"
            action={withReload(createAcademicYear, reload)}
          >
            <div className="space-y-1">
              <Label htmlFor="year-label">Libellé</Label>
              <Input id="year-label" name="label" placeholder="2025-2026" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="year-start">Début</Label>
              <Input id="year-start" name="startDate" type="date" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="year-end">Fin</Label>
              <Input id="year-end" name="endDate" type="date" required />
            </div>
          </CreateDialog>
          <div className="space-y-2">
            {years.length === 0 && <p className="text-sm text-muted-foreground">Aucune année pour le moment.</p>}
            {years.map(year => (
              <div key={year.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{year.label}</span>
                  {year.status === "en_cours" && <Badge>En cours</Badge>}
                  {year.status === "cloturee" && <Badge variant="secondary">Clôturée</Badge>}
                  {year.status === "planifiee" && <Badge variant="outline">Planifiée</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  {year.status !== "en_cours" && year.status !== "cloturee" && (
                    <Button size="sm" variant="outline" onClick={() => setActivateTarget(year)}>
                      <Play className="h-3.5 w-3.5" /> Activer
                    </Button>
                  )}
                  <ArchiveButton
                    action={archiveAcademicYear}
                    id={year.id}
                    title="Archiver l'année"
                    confirmMessage={`Archiver « ${year.label} » ? Les données restent consultables.`}
                    onDone={reload}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(activateTarget)}
        onOpenChange={(next) => { if (!next && !isPending) setActivateTarget(null) }}
      >
        <DialogClose onClick={() => { if (!isPending) setActivateTarget(null) }} />
        <DialogHeader>
          <DialogTitle>Activer {activateTarget?.label}</DialogTitle>
          <DialogDescription>
            {currentYear
              ? `« ${currentYear.label} » sera clôturée. « ${activateTarget?.label} » devient l'année en cours (notes, appels, facturation).`
              : `« ${activateTarget?.label} » devient l'année en cours (notes, appels, facturation).`}
          </DialogDescription>
        </DialogHeader>
        {actionError && <p className="mt-3 text-sm text-destructive">{actionError}</p>}
        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setActivateTarget(null)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={isPending || !activateTarget}
            onClick={() => activateTarget && runActivateYear(activateTarget.id)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activer"}
          </Button>
        </DialogFooter>
      </Dialog>
      <span className="hidden"><Plus className="h-4 w-4" /></span>
    </div>
  )
}
