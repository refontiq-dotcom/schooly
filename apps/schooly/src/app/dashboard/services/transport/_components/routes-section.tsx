import { Bus, Plus } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fmtCFA } from "../../_lib/format"
import { asActionResult, isActionOk, type BusRoute } from "../../_lib/types"

type RoutesSectionProps = {
  routes: BusRoute[]
  /** État piloté par la vue : la bannière guidance peut ouvrir le formulaire. */
  showForm: boolean
  onToggleForm: () => void
  onCloseForm: () => void
  onCreateRoute: (formData: FormData) => Promise<unknown>
}

/** Carte « Lignes de bus » : liste des trajets, création de ligne. */
export function RoutesSection({
  routes,
  showForm,
  onToggleForm,
  onCloseForm,
  onCreateRoute,
}: RoutesSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5" /> Lignes de bus
          </CardTitle>
          <CardDescription>Configurez les trajets et les conducteurs.</CardDescription>
        </div>
        <Button size="sm" onClick={onToggleForm}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle ligne
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <ActionForm
              action={async (formData) => {
                const result = asActionResult(await onCreateRoute(formData))
                if (!isActionOk(result)) return result
                onCloseForm()
              }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="space-y-1">
                <Label htmlFor="tr-name">Nom de la ligne *</Label>
                <Input id="tr-name" name="name" placeholder="Ex. Ligne Nord – Abobo" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-driver">Conducteur</Label>
                <Input id="tr-driver" name="driver_name" placeholder="Nom du chauffeur" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-phone">Téléphone</Label>
                <Input id="tr-phone" name="driver_phone" placeholder="+225 07 …" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-plate">Immatriculation</Label>
                <Input id="tr-plate" name="vehicle_plate" placeholder="AB 1234 CI" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-cap">Capacité (places)</Label>
                <Input id="tr-cap" name="capacity" type="number" min="1" placeholder="40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr-fee">Frais mensuel (FCFA)</Label>
                <Input id="tr-fee" name="monthly_fee_cfa" type="number" min="0" placeholder="15000" required />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCloseForm}>Annuler</Button>
                <Button type="submit" size="sm">Créer la ligne</Button>
              </div>
            </ActionForm>
          </div>
        )}

        {routes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Bus className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Aucune ligne configurée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <div key={route.id} className="flex items-start gap-4 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bus className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{route.name}</p>
                    <Badge variant={route.is_active ? "default" : "outline"}>
                      {route.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {route.driver_name ?? "—"} · {route.vehicle_plate ?? "—"} · {route.capacity ?? "?"} places
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtCFA(route.monthly_fee_cfa)}/mois ·{" "}
                    {route.bus_stops?.length ?? 0} arrêt(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
