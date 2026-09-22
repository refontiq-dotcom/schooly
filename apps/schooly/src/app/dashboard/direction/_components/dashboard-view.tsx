import { Badge } from "@/components/ui/badge"
import { formatFCFA } from "@/lib/formatters"
import { CreditCard, TrendingUp, Users, AlertCircle } from "lucide-react"
import type { DirectionDashboard } from "../dashboard-data"
import { StatCard } from "./stat-card"
import { DirectionIntelligence } from "./direction-intelligence"
import { ActionQueue } from "./action-queue"
import { TopDebtors, CashWidget, PaymentChart, MethodBreakdown } from "./finance-widgets"
import { LevelBreakdown } from "./students-widgets"
import { EmptyState } from "./empty-state"

/**
 * Composition du Bilan direction — purement présentationnelle (aucune
 * dépendance serveur), testée isolément.
 *
 * Hiérarchie de lecture (progressive disclosure) :
 * 1. 4 KPI prioritaires — ce qu'il faut savoir en 5 secondes
 * 2. Bannière « Schooly anticipe » pleine largeur — ce qui demande attention
 * 3. File d'actions · Impayés · Caisse (grille 3 équilibrée)
 * 4. Encaissements · Effectifs (grille 2 équilibrée)
 * 5. Modes d'encaissement — analytique, en dernier
 */
export function DashboardView({ dashboard }: { dashboard: DirectionDashboard }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilotage de l’établissement
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dashboard.activeYear && (
            <Badge variant="outline" className="border-primary text-primary">
              Année {dashboard.activeYear.label}
            </Badge>
          )}
          {dashboard.previousYear && (
            <Badge variant="ghost">
              Comparé à {dashboard.previousYear.label}
            </Badge>
          )}
        </div>
      </div>

      {!dashboard.hasData ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Élèves inscrits"
              value={dashboard.students.active.toLocaleString("fr-FR")}
              icon={Users}
              tone="primary"
              trend={dashboard.students.deltaPercent}
              hint={`${dashboard.students.newThisMonth} nouvelle(s) inscription(s) ce mois`}
            />
            <StatCard
              label="Encaissé ce mois"
              value={formatFCFA(dashboard.finance.collectedThisMonth)}
              icon={CreditCard}
              tone="green"
              trend={dashboard.finance.collectedDeltaPercent}
              hint={`Mois précédent : ${formatFCFA(dashboard.finance.collectedPreviousMonth)}`}
            />
            <StatCard
              label="Taux de recouvrement"
              value={`${dashboard.finance.recoveryRate.toFixed(0)} %`}
              icon={TrendingUp}
              tone="blue"
              progress={dashboard.finance.recoveryRate}
              hint={`${formatFCFA(dashboard.finance.collectedThisYear)} encaissés sur ${formatFCFA(dashboard.finance.expectedThisYear)} attendus`}
            />
            <StatCard
              label="Reste à recouvrer"
              value={formatFCFA(dashboard.finance.outstanding)}
              icon={AlertCircle}
              tone="amber"
              hint={`${dashboard.finance.debtorsCount} élève(s) avec un solde`}
            />
          </div>

          <DirectionIntelligence dashboard={dashboard} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div id="actions-requises">
              <ActionQueue items={dashboard.actionQueue} />
            </div>
            <TopDebtors data={dashboard.finance} />
            <CashWidget cash={dashboard.cash} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PaymentChart daily={dashboard.finance.daily} />
            <LevelBreakdown levels={dashboard.students.byLevel} />
          </div>

          <MethodBreakdown data={dashboard.finance} />
        </>
      )}
    </div>
  )
}
