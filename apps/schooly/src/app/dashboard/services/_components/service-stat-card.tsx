import type { ComponentType } from "react"
import { Card, CardContent } from "@/components/ui/card"

type ServiceStatCardProps = {
  value: number | string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Teinte de l'icône (utilitaires de couleur Tailwind). */
  iconClassName: string
}

// Carte statistique des écrans services : une valeur, un libellé, une icône.
export function ServiceStatCard({ value, label, icon: Icon, iconClassName }: ServiceStatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <Icon className={`h-8 w-8 ${iconClassName}`} />
      </CardContent>
    </Card>
  )
}
