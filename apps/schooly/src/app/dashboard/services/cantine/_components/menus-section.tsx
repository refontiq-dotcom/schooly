import { useState } from "react"
import { CalendarDays, Plus, UtensilsCrossed } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { asActionResult, isActionOk, type CanteenMenu } from "../../_lib/types"

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  snack: "Goûter",
}

type MenusSectionProps = {
  menus: CanteenMenu[]
  weekFrom: string
  weekTo: string
  today: string
  onCreateMenu: (formData: FormData) => Promise<unknown>
}

/** Carte « Menus de la semaine » : grille des menus, création de menu. */
export function MenusSection({ menus, weekFrom, weekTo, today, onCreateMenu }: MenusSectionProps) {
  const [showForm, setShowForm] = useState(false)

  const monday = new Date(weekFrom)
  const friday = new Date(weekTo)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Menus de la semaine
          </CardTitle>
          <CardDescription>
            Du {monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au{" "}
            {friday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowForm((f) => !f)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un menu
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <ActionForm
              action={async (formData) => {
                const result = await onCreateMenu(formData)
                if (!isActionOk(asActionResult(result))) return asActionResult(result)
                setShowForm(false)
              }}
              className="grid gap-3 sm:grid-cols-3"
            >
              <div className="space-y-1">
                <Label htmlFor="menu-date">Date *</Label>
                <Input id="menu-date" name="date" type="date" required defaultValue={today} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="menu-type">Type de repas</Label>
                <select
                  id="menu-type"
                  name="meal_type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="lunch"
                >
                  <option value="breakfast">Petit-déjeuner</option>
                  <option value="lunch">Déjeuner</option>
                  <option value="snack">Goûter</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-3">
                <Label htmlFor="menu-desc">Description du menu *</Label>
                <Input
                  id="menu-desc"
                  name="description"
                  placeholder="Riz gras au poulet, salade verte, jus de gingembre…"
                  required
                />
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" size="sm">Enregistrer</Button>
              </div>
            </ActionForm>
          </div>
        )}

        {menus.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Aucun menu planifié pour cette semaine.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <div key={menu.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    {new Date(menu.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <Badge variant="secondary">{MEAL_LABELS[menu.meal_type] ?? menu.meal_type}</Badge>
                </div>
                <p className="text-sm">{menu.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
