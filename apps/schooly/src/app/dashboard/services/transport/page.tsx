"use client"

import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ActionForm } from "@/components/action-form"
import {
  getBusRoutes,
  getTransportSubscriptions,
  getEnrollmentsForSelect,
  createBusRoute,
  createTransportSubscription,
} from "../actions"
import { Bus, Plus, Users, MapPin, AlertCircle } from "lucide-react"

type Route = {
  id: string
  name: string
  driver_name: string | null
  driver_phone: string | null
  vehicle_plate: string | null
  capacity: number | null
  monthly_fee_cfa: number
  is_active: boolean
  bus_stops: { id: string; name: string; pickup_time: string | null }[]
}

type Subscription = {
  id: string
  status: string
  start_date: string
  enrollments: any
  bus_routes: any
  bus_stops: any
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
}

function fmtCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}

export default function TransportPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [showSubForm, setShowSubForm] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState("")
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      const [routesRes, subsRes, enrollRes] = await Promise.all([
        getBusRoutes(),
        getTransportSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in routesRes) setRoutes(routesRes.data as Route[])
      if ("data" in subsRes) setSubs(subsRes.data as Subscription[])
      if ("data" in enrollRes) setEnrollments(enrollRes.data as any[])
    })
  }

  useEffect(() => { load() }, [])

  const selectedRouteFull = routes.find(r => r.id === selectedRoute)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{routes.length}</p>
              <p className="text-sm text-muted-foreground">Lignes de bus</p>
            </div>
            <Bus className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{subs.filter(s => s.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Abonnés actifs</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">
                {routes.reduce((acc, r) => acc + (r.bus_stops?.length ?? 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Arrêts enregistrés</p>
            </div>
            <MapPin className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      {/* Lignes de bus */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5" /> Lignes de bus
            </CardTitle>
            <CardDescription>Configurez les trajets et les conducteurs.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowRouteForm(f => !f)}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle ligne
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showRouteForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createBusRoute(fd); if (r && !r.ok) return r as any; load(); setShowRouteForm(false) }}
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
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowRouteForm(false)}>Annuler</Button>
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
              {routes.map(route => (
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

      {/* Abonnements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Abonnements élèves
            </CardTitle>
            <CardDescription>Rattachez les élèves aux lignes de bus.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowSubForm(f => !f)} disabled={routes.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Nouvel abonnement
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSubForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createTransportSubscription(fd); if (r && !r.ok) return r as any; load(); setShowSubForm(false) }}
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
                    {enrollments.map((e: any) => (
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
                    value={selectedRoute}
                    onChange={e => setSelectedRoute(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner une ligne</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                {selectedRouteFull && selectedRouteFull.bus_stops.length > 0 && (
                  <div className="space-y-1">
                    <Label htmlFor="sub-stop">Arrêt</Label>
                    <select
                      id="sub-stop"
                      name="stop_id"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Aucun arrêt spécifique</option>
                      {selectedRouteFull.bus_stops.map(stop => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}{stop.pickup_time ? ` (${stop.pickup_time})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="sub-start">Date de début *</Label>
                  <Input id="sub-start" name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSubForm(false)}>Annuler</Button>
                  <Button type="submit" size="sm">Inscrire l'élève</Button>
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
                  {subs.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        {(s.enrollments as any)?.students?.last_name} {(s.enrollments as any)?.students?.first_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {(s.enrollments as any)?.classes?.name}
                        </span>
                      </td>
                      <td className="py-2">{(s.bus_routes as any)?.name ?? "—"}</td>
                      <td className="py-2">{(s.bus_stops as any)?.name ?? "—"}</td>
                      <td className="py-2">{new Date(s.start_date).toLocaleDateString("fr-FR")}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_LABELS[s.status]?.variant ?? "outline"}>
                          {STATUS_LABELS[s.status]?.label ?? s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
