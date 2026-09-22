import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, Users, UtensilsCrossed } from "lucide-react"
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
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{activeCount}</p>
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
              <p className="text-3xl font-bold">{collected.toLocaleString("fr-FR")}</p>
              <p className="text-sm text-muted-foreground">FCFA encaissés</p>
            </div>
            <UtensilsCrossed className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
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
