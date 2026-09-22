"use client"

import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OpenSessionModal } from "../open-session-modal"
import type { BalanceInfo, CaisseEnrollment, CaissePayment, CashSession } from "../_lib/types"
import { CaisseSummarySection } from "./caisse-summary"
import { StudentDirectorySection } from "./student-directory"

type CaisseViewProps = {
  enrollments: CaisseEnrollment[]
  payments: CaissePayment[]
  session: CashSession | null
  balanceByEnrollment: Record<string, BalanceInfo>
  /** Borne ISO du jour (injectée pour la reproductibilité des tests). */
  today: string
  /** Rafraîchit les données après encaissement ou ouverture de session. */
  onRefresh: () => void
}

/** Écran Caisse : statut de session + recherche élève + résumé du jour. */
export function CaisseView({
  enrollments,
  payments,
  session,
  balanceByEnrollment,
  today,
  onRefresh,
}: CaisseViewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* En-tête : statut de la session + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caisse</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {session
              ? `Session ouverte depuis ${new Date(session.opened_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — fond ${session.opening_amount.toLocaleString("fr-FR")} FCFA`
              : "Aucune session ouverte — obligatoire pour encaisser en espèces."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Badge variant="default" className="bg-green-800">
                <ShieldCheck className="h-3 w-3 mr-1" /> Session ouverte
              </Badge>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="/dashboard/caisse/close">Clôturer</a>
              </Button>
            </>
          ) : (
            <OpenSessionModal onOpened={onRefresh} />
          )}
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href="/dashboard/caisse/history">Historique</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StudentDirectorySection
            enrollments={enrollments}
            balanceByEnrollment={balanceByEnrollment}
            onPaySuccess={onRefresh}
          />
        </div>
        <CaisseSummarySection payments={payments} today={today} />
      </div>
    </div>
  )
}
