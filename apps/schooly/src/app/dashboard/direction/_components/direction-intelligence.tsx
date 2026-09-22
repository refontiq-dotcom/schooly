import { IntelligentGuidance } from "@/components/intelligent-guidance"
import { termProgress, progressiveThreshold } from "@/lib/guidance"
import type { DirectionDashboard } from "../dashboard-data"

/**
 * Bannière « Schooly anticipe » : le ciblage des actions prioritaires.
 * Pleine largeur — c'est la première chose lue après les KPI.
 */
export function DirectionIntelligence({ dashboard }: { dashboard: DirectionDashboard }) {
  const crowded = dashboard.students.byLevel.filter(level => (level.fillRate ?? 0) >= 90)
  const pending = dashboard.actionQueue.filter(item => item.count > 0)
  const progress = dashboard.activeYear ? termProgress(dashboard.activeYear.startDate, dashboard.activeYear.endDate) : 0
  const expectedRecoveryRate = progressiveThreshold(30, 85, progress)
  const items = [
    ...(!dashboard.activeYear ? [{ id: "year", title: "Aucune année académique active", description: "La plupart des opérations pédagogiques et administratives dépendent d’une année en cours.", severity: "critical" as const, actionLabel: "Préparer la structure", href: "/dashboard/academic-structure" }] : []),
    ...(crowded.length > 0 ? [{ id: "capacity", title: `${crowded.length} niveau(x) approchent de la capacité disponible`, description: "Schooly détecte un risque de saturation à partir des effectifs et capacités configurés. Vérifiez les classes avant de nouvelles admissions.", severity: "warning" as const, actionLabel: "Voir la structure", href: "/dashboard/academic-structure", weight: crowded.length }] : []),
    ...(dashboard.finance.recoveryRate < expectedRecoveryRate && dashboard.finance.debtorsCount > 0 ? [{ id: "recovery", title: `Recouvrement à ${dashboard.finance.recoveryRate}%, en retard sur le rythme attendu (~${Math.round(expectedRecoveryRate)}% à ce stade de l’année)`, description: `${dashboard.finance.debtorsCount} élève(s) présentent encore un solde. Schooly vous propose de traiter les relances avant que les impayés ne s’aggravent.`, severity: (expectedRecoveryRate - dashboard.finance.recoveryRate > 20 ? ("action" as const) : ("warning" as const)), actionLabel: "Gérer les relances", href: "/dashboard/direction/finance/reminders" }] : []),
    ...(pending.length > 0 ? [{ id: "queue", title: `${pending.length} décision(s) attendent votre intervention`, description: "Traitez d’abord les éléments en attente pour éviter qu’ils ne bloquent les étapes suivantes.", severity: "action" as const, actionLabel: "Voir les actions", href: "#actions-requises", weight: pending.length }] : []),
  ]
  return <IntelligentGuidance items={items} title="Schooly anticipe les prochaines actions" contextKey="direction-dashboard" />
}
