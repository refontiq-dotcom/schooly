import { CalendarDays, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { YEAR_STATUS_CONFIG, type AcademicYear } from "./types"

type YearsListCardProps = {
  years: AcademicYear[]
}

/** Années académiques en lecture seule (gestion : onglet « Années »). */
export function YearsListCard({ years }: YearsListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Années académiques
        </CardTitle>
        <CardDescription>
          Cycle scolaire de l&apos;établissement. La création et l&apos;activation des années se
          font depuis l&apos;onglet « Années ».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {years.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">
            Aucune année configurée.
          </p>
        ) : (
          <div className="space-y-2">
            {years.map((year) => {
              const cfg = YEAR_STATUS_CONFIG[year.status] ?? {
                label: year.status,
                variant: "outline" as const,
              }
              return (
                <div key={year.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{year.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(year.start_date).toLocaleDateString("fr-FR")} →{" "}
                        {new Date(year.end_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
