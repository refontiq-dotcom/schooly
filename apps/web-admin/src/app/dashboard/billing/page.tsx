import { redirect } from "next/navigation"
import {
  getBillingContext,
  getSchoolBillingSummary,
  getMyPaymentRequests,
  getAllPendingRequests,
} from "./actions"
import { PaymentSubmissionFormClient } from "@/components/billing/PaymentSubmissionFormClient"
import { AdminValidationPanelClient } from "@/components/billing/AdminValidationPanelClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatFCFA } from "@/lib/formatters"

export default async function BillingPage() {
  const ctx = await getBillingContext().catch(() => null)
  if (!ctx) redirect("/login")

  const { schoolId, isSuperAdmin, school, roleCode } = ctx

  // Super Admin : voit toutes les demandes
  if (isSuperAdmin) {
    const all = await getAllPendingRequests()
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Facturation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Validation des versements établissements — Schooly
          </p>
        </div>
        <AdminValidationPanelClient requests={all.data || []} />
      </div>
    )
  }

  // Établissement : voit son résumé + formulaire de versement
  if (!schoolId) redirect("/login")

  const billing = await getSchoolBillingSummary(schoolId)
  const myRequests = await getMyPaymentRequests()
  const hasPending = billing.pendingRequests.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Facturation</h1>
        <p className="text-sm text-slate-500 mt-1">
          {school?.name || "Mon établissement"} — {school?.city || ""}
        </p>
      </div>

      {/* Résumé facturation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inscriptions actives</CardDescription>
            <CardTitle className="text-2xl">{billing.totalEvents}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              × {formatFCFA(billing.eventAmount)} / inscription
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reste à verser</CardDescription>
            <CardTitle className="text-2xl">{formatFCFA(billing.expectedAmount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {billing.remainingEvents} inscription(s) non couverte(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Versé (validé)</CardDescription>
            <CardTitle className="text-2xl">{formatFCFA(billing.validatedSum)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {billing.totalRequests} demande(s) au total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire de versement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Effectuer un versement
          </h2>
          {hasPending ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    En attente
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      Demande déjà soumise
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Votre demande de {formatFCFA(billing.pendingSum)} est en cours de validation par le Super Admin.
                      Vous pourrez soumettre une nouvelle demande une fois validée ou rejetée.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <PaymentSubmissionFormClient
              amount={billing.expectedAmount}
              schoolId={schoolId}
            />
          )}
        </div>

        {/* Historique des demandes */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Mes demandes
          </h2>
          {myRequests.data && myRequests.data.length > 0 ? (
            <div className="space-y-2">
              {myRequests.data.map((r) => (
                <Card key={r.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {formatFCFA(r.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-300"
                          : r.status === "validated"
                            ? "bg-green-50 text-green-700 border-green-300"
                            : "bg-red-50 text-red-700 border-red-300"
                      }
                    >
                      {r.status === "pending"
                        ? "En attente"
                        : r.status === "validated"
                          ? "Validé"
                          : "Rejeté"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">
                  Aucune demande pour le moment.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
