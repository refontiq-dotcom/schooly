"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteFeeSchedule } from "@/app/dashboard/finance/actions"

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

export function FeeScheduleManager({ schedules }: { schedules: ScheduleRow[] }) {
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

  return (
    <div className="space-y-4">
      {/* Liste seule : l'ajout et la duplication vivent dans des modales */}
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
                Aucune grille tarifaire configurée — utilisez « Nouveau tarif » ci-dessus.
              </p>
            )}
      </div>
    </div>
  )
}
