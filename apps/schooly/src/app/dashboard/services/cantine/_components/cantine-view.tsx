import { CalendarDays, Users, UtensilsCrossed } from "lucide-react"
import { ServiceStatCard } from "../../_components/service-stat-card"
import { CanteenSubscriptionsSection } from "./canteen-subscriptions-section"
import { MenusSection } from "./menus-section"
import type { CanteenMenu, EnrollmentOption, ServiceSub } from "../../_lib/types"

type CantineViewProps = {
  menus: CanteenMenu[]
  subs: ServiceSub[]
  enrollments: EnrollmentOption[]
  /** Bornes ISO de la semaine affichée (lundi → vendredi). */
  weekFrom: string
  weekTo: string
  /** Date ISO du jour, injectée pour la reproductibilité des tests. */
  today: string
  onCreateMenu: (formData: FormData) => Promise<unknown>
  onCreateSub: (formData: FormData) => Promise<unknown>
}

export function CantineView({
  menus,
  subs,
  enrollments,
  weekFrom,
  weekTo,
  today,
  onCreateMenu,
  onCreateSub,
}: CantineViewProps) {
  const activeCount = subs.filter((s) => s.status === "active").length
  const collected = subs.reduce((acc, s) => acc + (s.amount_cfa || 0), 0)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ServiceStatCard value={activeCount} label="Abonnés actifs" icon={Users} iconClassName="text-primary" />
        <ServiceStatCard value={menus.length} label="Menus cette semaine" icon={CalendarDays} iconClassName="text-orange-500" />
        <ServiceStatCard value={collected.toLocaleString("fr-FR")} label="FCFA encaissés" icon={UtensilsCrossed} iconClassName="text-green-500" />
      </div>

      <MenusSection
        menus={menus}
        weekFrom={weekFrom}
        weekTo={weekTo}
        today={today}
        onCreateMenu={onCreateMenu}
      />

      <CanteenSubscriptionsSection
        subs={subs}
        enrollments={enrollments}
        today={today}
        onCreateSub={onCreateSub}
      />
    </div>
  )
}
