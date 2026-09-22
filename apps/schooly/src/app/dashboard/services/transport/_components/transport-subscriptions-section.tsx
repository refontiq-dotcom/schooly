import { useState } from "react"
import { Plus, Users } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "../../_components/status-badge"
import { asActionResult, isActionOk, type BusRoute, type EnrollmentOption, type TransportSub } from "../../_lib/types"

type TransportSubscriptionsSectionProps = {
  subs: TransportSub[]
  enrollments: EnrollmentOption[]
  routes: BusRoute[]
  /** État piloté par la vue : la bannière guidance peut ouvrir le formulaire. */
  showForm: boolean
  onToggleForm: () => void
  onCloseForm: () => void
  onCreateSub: (formData: FormData) => Promise<unknown>
}

/** Carte « Abonnements élèves » : table des abonnés, rattachement à une ligne. */
export function TransportSubscriptionsSection({
  subs,
  enrollments,
  routes,
  showForm,
  onToggleForm,
  onCloseForm,
  onCreateSub,
}: TransportSubscriptionsSectionProps) {
  const [selectedRouteId, setSelectedRouteId] = useState("")
  const selectedRoute = routes.find((r) => r.id === selectedRouteId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Abonnements élèves
          </CardTitle>
          <CardDescription>Rattachez les élèves aux lignes de bus.</CardDescription>
        </div>
        <Button size="sm" onClick={onToggleForm} disabled={routes.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel abonnement
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <ActionForm
              action={async (formData) => {
                const result = asActionResult(await onCreateSub(formData))
                if (!isActionOk(result)) return result
                setSelectedRouteId("")
                onCloseForm()
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="space-y-1">
                <Label htmlFor="sub-enrollment">Élève *</Label>
                <select
                  id="sub-enrollment"
                  name="enrollment_id"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner un élève</option>
                  {enrollments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.students?.last_name} {e.students?.first_name} — {e.classes?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sub-route">Ligne *</Label>
                <select
                  id="sub-route"
                  name="route_id"
                  required
                  value={selectedRouteId}
                  onChange={(event) => setSelectedRouteId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner une ligne</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>{route.name}</option>
                  ))}
                </select>
              </div>
              {selectedRoute && (selectedRoute.bus_stops?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="sub-stop">Arrêt</Label>
                  <select
                    id="sub-stop"
                    name="stop_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Aucun arrêt spécifique</option>
                    {selectedRoute.bus_stops!.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name}{stop.pickup_time ? ` (${stop.pickup_time})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="sub-start">Date de début *</Label>
                <Input id="sub-start" name="start_date" type="date" required />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCloseForm}>Annuler</Button>
                <Button type="submit" size="sm">Inscrire l&apos;élève</Button>
              </div>
            </ActionForm>
          </div>
        )}

        {subs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Aucun abonnement enregistré.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 font-medium">Élève</th>
                  <th className="text-left py-2 font-medium">Ligne</th>
                  <th className="text-left py-2 font-medium">Arrêt</th>
                  <th className="text-left py-2 font-medium">Depuis</th>
                  <th className="text-left py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2">
                      {sub.enrollments?.students?.last_name} {sub.enrollments?.students?.first_name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sub.enrollments?.classes?.name}
                      </span>
                    </td>
                    <td className="py-2">{sub.bus_routes?.name ?? "—"}</td>
                    <td className="py-2">{sub.bus_stops?.name ?? "—"}</td>
                    <td className="py-2">{new Date(sub.start_date).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2">
                      <StatusBadge status={sub.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
