"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ActionForm } from "@/components/action-form"
import { Copy, Plus, Trash2 } from "lucide-react"
import {
  createFeeSchedule,
  deleteFeeSchedule,
  duplicateFeeSchedule,
} from "@/app/dashboard/finance/actions"

export type ScheduleRow = {
  id: string
  amount: number
  label: string | null
  grade_level_id: string | null
  financial_profile_id: string | null
  academic_year_id: string
  financial_profiles: { name: string }[] | null
  grade_levels: { name: string }[] | null
  academic_years: { label: string }[] | null
}

type Option = { id: string; name: string }
type YearOption = { id: string; label: string }

export function FeeScheduleManager({
  schedules,
  profiles,
  gradeLevels,
  years,
}: {
  schedules: ScheduleRow[]
  profiles: Option[]
  gradeLevels: Option[]
  years: YearOption[]
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete(id: string) {
    const row = schedules.find((s) => s.id === id)
    if (
      !window.confirm(
        `Retirer « ${row?.grade_levels?.[0]?.name ?? "?"} — ${row?.amount.toLocaleString("fr-FR")} FCFA » de la grille ?`
      )
    ) {
      return
    }
    setDeletingId(id)
    const fd = new FormData()
    fd.set("id", id)
    startTransition(async () => {
      const result = await deleteFeeSchedule(fd)
      if (result?.error) toast.error(result.error)
      else toast.success("Ligne retirée de la grille.")
      setDeletingId(null)
    })
  }

  async function handleDuplicate(formData: FormData) {
    const fd = formData
    await startTransition(async () => {
      const result = await duplicateFeeSchedule(fd)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      const data = result?.data as { copied: number; skipped: number } | undefined
      toast.success(
        `Grille dupliquée : ${data?.copied ?? 0} ligne(s) copiée(s)${data?.skipped ? `, ${data.skipped} déjà présente(s) ignorée(s)` : ""}.`
      )
    })
  }

  return (
    <div className="space-y-4">
      {/* Formulaire : nouveau tarif */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Ajouter un tarif
          </CardTitle>
          <CardDescription>
            Niveau × profil financier × année. Le profil « Standard » couvre les élèves sans profil particulier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createFeeSchedule}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gradeLevelId">Niveau *</Label>
                <Select name="gradeLevelId" required>
                  <SelectTrigger id="gradeLevelId" ariaLabel="Niveau">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="financialProfileId">Profil financier</Label>
                <Select name="financialProfileId">
                  <SelectTrigger id="financialProfileId" ariaLabel="Profil financier">
                    <SelectValue placeholder="Standard (aucun)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard (aucun)</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="academicYearId">Année académique *</Label>
                <Select name="academicYearId" required>
                  <SelectTrigger id="academicYearId" ariaLabel="Année académique">
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
                <Label htmlFor="amount">Montant annuel (FCFA) *</Label>
                <Input id="amount" name="amount" type="number" min="1" required placeholder="180000" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="label">Libellé (optionnel)</Label>
                <Input id="label" name="label" placeholder="Ex. : frais de scolarité hors transport" />
              </div>
            </div>
            <div className="mt-3">
              <Button type="submit" disabled={pending}>Enregistrer le tarif</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {/* Duplication d'année */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4" /> Dupliquer la grille vers une autre année
          </CardTitle>
          <CardDescription>
            À la rentrée : copie tous les tarifs de l&apos;année source vers la cible en un clic. Les lignes déjà présentes sont ignorées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {years.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Créez d&apos;abord une deuxième année académique (Structure académique) pour dupliquer.
            </p>
          ) : (
            <ActionForm action={handleDuplicate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sourceYearId">Année source *</Label>
                  <Select name="sourceYearId" required>
                    <SelectTrigger id="sourceYearId" ariaLabel="Année source">
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
                  <Label htmlFor="targetYearId">Année cible *</Label>
                  <Select name="targetYearId" required>
                    <SelectTrigger id="targetYearId" ariaLabel="Année cible">
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
              <div className="mt-3">
                <Button type="submit" variant="secondary" disabled={pending}>Dupliquer</Button>
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grille en vigueur ({schedules.length} ligne(s))</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {schedules.map((fs) => (
              <div key={fs.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <p className="font-medium">
                    {fs.grade_levels?.[0]?.name} · {fs.financial_profiles?.[0]?.name || "Standard"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fs.academic_years?.[0]?.label} {fs.label ? `· ${fs.label}` : ""}
                </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">
                    {fs.amount.toLocaleString("fr-FR")} FCFA
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending && deletingId === fs.id}
                    onClick={() => handleDelete(fs.id)}
                    aria-label={`Retirer ${fs.grade_levels?.[0]?.name ?? "la ligne"} de la grille`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune grille tarifaire configurée — ajoutez votre premier tarif ci-dessus.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
