"use client"

import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ActionForm } from "@/components/action-form"
import {
  getCanteenMenus,
  getCanteenSubscriptions,
  getEnrollmentsForSelect,
  createCanteenMenu,
  createCanteenSubscription,
} from "../actions"
import { UtensilsCrossed, Plus, Users, CalendarDays } from "lucide-react"

function fmtCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  snack: "Goûter",
}

const PLAN_LABELS: Record<string, string> = {
  daily: "Journalier",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  annual: "Annuel",
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
}

export default function CantinePage() {
  const [menus, setMenus] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [showSubForm, setShowSubForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Semaine courante
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const weekFrom = monday.toISOString().slice(0, 10)
  const weekTo = friday.toISOString().slice(0, 10)

  const load = () => {
    startTransition(async () => {
      const [menusRes, subsRes, enrollRes] = await Promise.all([
        getCanteenMenus(weekFrom, weekTo),
        getCanteenSubscriptions(),
        getEnrollmentsForSelect(),
      ])
      if ("data" in menusRes) setMenus(menusRes.data as any[])
      if ("data" in subsRes) setSubs(subsRes.data as any[])
      if ("data" in enrollRes) setEnrollments(enrollRes.data as any[])
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{subs.filter(s => s.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Abonnés actifs</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{menus.length}</p>
              <p className="text-sm text-muted-foreground">Menus cette semaine</p>
            </div>
            <CalendarDays className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{subs.reduce((acc, s) => acc + (s.amount_cfa || 0), 0).toLocaleString("fr-FR")}</p>
              <p className="text-sm text-muted-foreground">FCFA encaissés</p>
            </div>
            <UtensilsCrossed className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      {/* Menus de la semaine */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Menus de la semaine
            </CardTitle>
            <CardDescription>
              Du {monday.toLocaleDateString("fr-FR")} au {friday.toLocaleDateString("fr-FR")}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowMenuForm(f => !f)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un menu
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showMenuForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createCanteenMenu(fd); if (r && !r.ok) return r as any; load(); setShowMenuForm(false) }}
                className="grid gap-3 sm:grid-cols-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="menu-date">Date *</Label>
                  <Input id="menu-date" name="date" type="date" required defaultValue={today.toISOString().slice(0, 10)} />
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
                  <Input id="menu-desc" name="description" placeholder="Riz gras au poulet, salade verte, jus de gingembre…" required />
                </div>
                <div className="sm:col-span-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowMenuForm(false)}>Annuler</Button>
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
              {menus.map(menu => (
                <div key={menu.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      {new Date(menu.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
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

      {/* Abonnements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Abonnements cantine
            </CardTitle>
            <CardDescription>Rattachez les élèves à un plan de cantine.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowSubForm(f => !f)}>
            <Plus className="h-4 w-4 mr-1" /> Nouvel abonnement
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSubForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => { const r = await createCanteenSubscription(fd); if (r && !r.ok) return r as any; load(); setShowSubForm(false) }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label htmlFor="cant-enrollment">Élève *</Label>
                  <select
                    id="cant-enrollment"
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
                  <Label htmlFor="cant-plan">Plan *</Label>
                  <select
                    id="cant-plan"
                    name="plan_type"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Mensuel</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="daily">Journalier</option>
                    <option value="annual">Annuel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cant-amount">Montant (FCFA)</Label>
                  <Input id="cant-amount" name="amount_cfa" type="number" min="0" placeholder="25000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cant-start">Date de début *</Label>
                  <Input id="cant-start" name="start_date" type="date" required defaultValue={today.toISOString().slice(0, 10)} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSubForm(false)}>Annuler</Button>
                  <Button type="submit" size="sm">Inscrire</Button>
                </div>
              </ActionForm>
            </div>
          )}

          {subs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aucun abonnement cantine.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Élève</th>
                    <th className="text-left py-2 font-medium">Plan</th>
                    <th className="text-left py-2 font-medium">Montant</th>
                    <th className="text-left py-2 font-medium">Depuis</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">
                        {s.enrollments?.students?.last_name} {s.enrollments?.students?.first_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {s.enrollments?.classes?.name}
                        </span>
                      </td>
                      <td className="py-2">{PLAN_LABELS[s.plan_type] ?? s.plan_type}</td>
                      <td className="py-2">{fmtCFA(s.amount_cfa)}</td>
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
