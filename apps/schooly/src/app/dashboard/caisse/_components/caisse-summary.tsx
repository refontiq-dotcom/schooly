import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { paymentsForDay, totalOf } from "../_lib/helpers"
import type { CaissePayment } from "../_lib/types"

/** Nombre de transactions affichées dans « Derniers encaissements ». */
const RECENT_LIMIT = 5

type CaisseSummarySectionProps = {
  payments: CaissePayment[]
  /** Borne ISO du jour (injectée pour la reproductibilité des tests). */
  today: string
}

/** Colonne de droite : total du jour + derniers encaissements. */
export function CaisseSummarySection({ payments, today }: CaisseSummarySectionProps) {
  const todayPayments = paymentsForDay(payments, today)
  const todayTotal = totalOf(todayPayments)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Aujourd’hui</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{todayTotal.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-xs text-muted-foreground mt-1">
            {todayPayments.length} transaction(s)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Derniers encaissements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payments.slice(0, RECENT_LIMIT).map((p) => (
              <div
                key={p.id}
                data-recent-payment
                className="flex items-center justify-between p-2 rounded-lg border text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {p.enrollments?.students?.last_name} {p.enrollments?.students?.first_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_method} · {new Date(p.received_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <span className="font-mono font-semibold">
                  {p.amount.toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun encaissement.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
