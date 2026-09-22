import { useState } from "react"
import { Plus, Users } from "lucide-react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "../../_components/status-badge"
import { fmtCFA } from "../../_lib/format"
import { asActionResult, isActionOk, type EnrollmentOption, type ServiceSub } from "../../_lib/types"

const PLAN_LABELS: Record<string, string> = {
  daily: "Journalier",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  annual: "Annuel",
}

type CanteenSubscriptionsSectionProps = {
  subs: ServiceSub[]
  enrollments: EnrollmentOption[]
  today: string
  onCreateSub: (formData: FormData) => Promise<unknown>
}

/** Carte « Abonnements cantine » : table des abonnés, inscription d'un élève. */
export function CanteenSubscriptionsSection({
  subs,
  enrollments,
  today,
  onCreateSub,
}: CanteenSubscriptionsSectionProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Abonnements cantine
          </CardTitle>
          <CardDescription>Rattachez les élèves à un plan de cantine.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowForm((f) => !f)}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel abonnement
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <ActionForm
              action={async (formData) => {
                const result = await onCreateSub(formData)
                if (!isActionOk(asActionResult(result))) return asActionResult(result)
                setShowForm(false)
              }}
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
                  {enrollments.map((e) => (
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
                <Input id="cant-start" name="start_date" type="date" required defaultValue={today} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
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
                {subs.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2">
                      {sub.enrollments?.students?.last_name} {sub.enrollments?.students?.first_name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sub.enrollments?.classes?.name}
                      </span>
                    </td>
                    <td className="py-2">{PLAN_LABELS[sub.plan_type ?? ""] ?? sub.plan_type}</td>
                    <td className="py-2">{fmtCFA(sub.amount_cfa ?? 0)}</td>
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
