import { redirect } from "next/navigation"
import {
  getBillingContext,
  getSchoolBillingSummary,
  getMyPaymentRequests,
} from "./actions"
import { PaymentSubmissionFormClient } from "@/components/billing/PaymentSubmissionFormClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatFCFA } from "@/lib/formatters"

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export default async function BillingPage() {
  const ctx = await getBillingContext().catch(() => null)
  if (!ctx) redirect("/login")

  const { schoolId, school } = ctx
  if (!schoolId) redirect("/login")

  const billing = await getSchoolBillingSummary()
  const myRequests = await getMyPaymentRequests()
  const hasPending = billing.pendingRequests.length > 0
  const accessStatus = billing.access?.status ?? "active"
  const accessMeta = accessStatus === "suspended"
    ? { label: "Service suspendu", className: "border-red-300 bg-red-50 text-red-800", description: "L’accès aux fonctions de Schooly est suspendu jusqu’à validation du règlement. La facturation, le paiement et l’export des données restent accessibles." }
    : accessStatus === "restricted"
      ? { label: "Accès restreint", className: "border-amber-300 bg-amber-50 text-amber-800", description: "L’établissement est en retard de paiement. Seuls les espaces nécessaires au règlement restent accessibles." }
      : accessStatus === "grace"
        ? { label: "Période de grâce", className: "border-orange-200 bg-orange-50 text-orange-800", description: "Un solde reste dû, mais l’établissement conserve pour le moment toutes les fonctionnalités." }
        : { label: "Service actif", className: "border-green-200 bg-green-50 text-green-800", description: "Aucun blocage de service lié à la facturation." }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Facturation Schooly</h1>
        <p className="text-sm text-slate-500 mt-1">
          {school?.name || "Mon établissement"}{school?.city ? ` — ${school.city}` : ""}
        </p>
      </div>

      <Card className={accessMeta.className}>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{accessMeta.label}</p>
              <p className="text-sm mt-1">{accessMeta.description}</p>
            </div>
            {billing.access?.oldest_unpaid_at && accessStatus !== "active" ? (
              <Badge variant="outline" className="w-fit bg-white/70">
                Retard : {billing.access.days_overdue} jour{billing.access.days_overdue > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Tarification Schooly</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                1 000 FCFA par élève et par année scolaire. Une réinscription sur une nouvelle année scolaire est facturée à nouveau.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-blue-300 bg-white text-blue-800 dark:bg-slate-900 dark:text-blue-200">
              1 000 FCFA / élève / an
            </Badge>
          </div>
        </CardContent>
      </Card>

      {billing.academicYear ? (
        <>
          <div>
            <p className="text-sm font-medium text-slate-500">Facturation de l’année scolaire</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{billing.academicYear.label}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Du {formatDate(billing.academicYear.start_date)} au {formatDate(billing.academicYear.end_date)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Élèves facturables</CardDescription>
                <CardTitle className="text-2xl">{billing.billableStudents}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">Inscriptions confirmées comptabilisées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total dû</CardDescription>
                <CardTitle className="text-2xl">{formatFCFA(billing.billedAmount)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">{billing.billableStudents} × {formatFCFA(billing.eventAmount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Versements validés</CardDescription>
                <CardTitle className="text-2xl">{formatFCFA(billing.validatedSum)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">Demandes validées sur la période</p>
              </CardContent>
            </Card>

            <Card className={billing.remainingAmount > 0 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50"}>
              <CardHeader className="pb-2">
                <CardDescription>Reste à payer</CardDescription>
                <CardTitle className="text-2xl">{formatFCFA(billing.remainingAmount)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  {billing.pendingSum > 0 ? `${formatFCFA(billing.pendingSum)} en attente de validation` : "Aucun versement en attente"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Règle de facturation</CardTitle>
              <CardDescription>Le calcul est rattaché à l’année scolaire affichée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <span className="font-semibold text-slate-900 dark:text-white">1.</span>
                <p>Une inscription confirmée est facturée une seule fois : 1 000 FCFA pour l’année concernée.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-slate-900 dark:text-white">2.</span>
                <p>La réinscription du même élève sur une nouvelle année scolaire déclenche une nouvelle facturation de 1 000 FCFA.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-slate-900 dark:text-white">3.</span>
                <p>Un départ en cours d’année ne supprime pas la facturation déjà acquise pour cette année scolaire.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-semibold text-slate-900 dark:text-white">4.</span>
                <p>Les inscriptions tardives restent facturables lorsqu’elles sont confirmées : une inscription confirmée en janvier ou février de la même année scolaire ajoute 1 000 FCFA au solde, avec son propre délai de paiement.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Effectuer un versement</h2>
              {hasPending ? (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        En attente
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-amber-900">Demande déjà soumise</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Votre demande de {formatFCFA(billing.pendingSum)} est en cours de validation par le Centre de Contrôle.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : billing.remainingAmount > 0 ? (
                <PaymentSubmissionFormClient amount={billing.remainingAmount} schoolId={schoolId} />
              ) : (
                <Card className="border-green-200 bg-green-50/60">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-green-800">Facturation de l’année couverte.</p>
                    <p className="text-xs text-green-700 mt-1">Aucun versement supplémentaire n’est demandé pour le moment.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Historique des versements</h2>
              {myRequests.data && myRequests.data.length > 0 ? (
                <div className="space-y-2">
                  {myRequests.data.slice(0, 8).map((r) => (
                    <Card key={r.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatFCFA(r.amount)}</p>
                          <p className="text-xs text-slate-500">{formatDate(r.created_at)}</p>
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
                          {r.status === "pending" ? "En attente" : r.status === "validated" ? "Validé" : "Rejeté"}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-500">Aucun versement enregistré pour le moment.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Aucune année scolaire en cours.</p>
            <p className="text-sm text-slate-500 mt-1">La facturation Schooly apparaîtra automatiquement dès qu’une année scolaire sera ouverte.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
