import { useState } from "react"
import { Bus, MapPin, Users } from "lucide-react"
import { IntelligentGuidance } from "@/components/intelligent-guidance"
import { ServiceStatCard } from "../../_components/service-stat-card"
import type { BusRoute, EnrollmentOption, TransportSub } from "../../_lib/types"
import { RoutesSection } from "./routes-section"
import { TransportSubscriptionsSection } from "./transport-subscriptions-section"

type TransportViewProps = {
  routes: BusRoute[]
  subs: TransportSub[]
  enrollments: EnrollmentOption[]
  onCreateRoute: (formData: FormData) => Promise<unknown>
  onCreateSub: (formData: FormData) => Promise<unknown>
  /** Ouvre les inscriptions (guidance : aucun élève à abonner). */
  onOpenAdmissions: () => void
}

export function TransportView({
  routes,
  subs,
  enrollments,
  onCreateRoute,
  onCreateSub,
  onOpenAdmissions,
}: TransportViewProps) {
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [showSubForm, setShowSubForm] = useState(false)

  const activeCount = subs.filter((s) => s.status === "active").length
  const stopsCount = routes.reduce((acc, r) => acc + (r.bus_stops?.length ?? 0), 0)
  const routeAtCapacity = routes.some((route) => {
    if ((route.capacity ?? 0) <= 0) return false
    const activeOnRoute = subs.filter(
      (s) => s.status === "active" && s.bus_routes?.id === route.id,
    ).length
    return activeOnRoute >= (route.capacity ?? Infinity)
  })

  return (
    <div className="space-y-6">
      <IntelligentGuidance
        items={[
          ...(routes.length === 0
            ? [{
                id: "route",
                title: "Aucune ligne de transport n’est configurée",
                description: "Créez une ligne avant de pouvoir proposer un abonnement à un élève.",
                severity: "critical" as const,
                actionLabel: "Créer une ligne",
                onAction: () => setShowRouteForm(true),
              }]
            : []),
          ...(routes.length > 0 && enrollments.length === 0
            ? [{
                id: "enrollments",
                title: "Aucune inscription élève disponible",
                description:
                  "Les abonnements ne peuvent être rattachés qu’à des élèves inscrits dans l’établissement.",
                severity: "critical" as const,
                actionLabel: "Ouvrir les inscriptions",
                onAction: onOpenAdmissions,
              }]
            : []),
          ...(routeAtCapacity
            ? [{
                id: "capacity",
                title: "Une capacité de transport semble atteinte",
                description: "Vérifiez les abonnements actifs avant d’ajouter de nouveaux élèves.",
                severity: "warning" as const,
              }]
            : []),
          ...(routes.length > 0 && enrollments.length > 0 && subs.length === 0
            ? [{
                id: "subscription",
                title: "Le transport est prêt à recevoir son premier abonnement",
                description: "Une ligne et des élèves inscrits sont disponibles.",
                severity: "action" as const,
                actionLabel: "Nouvel abonnement",
                onAction: () => setShowSubForm(true),
              }]
            : []),
        ]}
        contextKey="transport"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ServiceStatCard value={routes.length} label="Lignes de bus" icon={Bus} iconClassName="text-primary" />
        <ServiceStatCard value={activeCount} label="Abonnés actifs" icon={Users} iconClassName="text-green-500" />
        <ServiceStatCard value={stopsCount} label="Arrêts enregistrés" icon={MapPin} iconClassName="text-orange-500" />
      </div>

      <RoutesSection
        routes={routes}
        showForm={showRouteForm}
        onToggleForm={() => setShowRouteForm((f) => !f)}
        onCloseForm={() => setShowRouteForm(false)}
        onCreateRoute={onCreateRoute}
      />

      <TransportSubscriptionsSection
        subs={subs}
        enrollments={enrollments}
        routes={routes}
        showForm={showSubForm}
        onToggleForm={() => setShowSubForm((f) => !f)}
        onCloseForm={() => setShowSubForm(false)}
        onCreateSub={onCreateSub}
      />
    </div>
  )
}
