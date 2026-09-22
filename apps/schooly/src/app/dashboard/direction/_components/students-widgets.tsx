import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { GraduationCap } from "lucide-react"
import type { DirectionDashboard } from "../dashboard-data"

export function LevelBreakdown({
  levels,
}: {
  levels: DirectionDashboard["students"]["byLevel"]
}) {
  const max = Math.max(...levels.map((level) => level.count), 1)
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-primary/10 p-1.5">
            <GraduationCap className="h-4 w-4 text-primary" />
          </span>
          Effectif par niveau
        </CardTitle>
        <CardDescription>Taux de remplissage des classes par niveau.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {levels.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun niveau configuré.
          </p>
        )}
        {levels.slice(0, 7).map((level) => (
          <div key={level.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{level.name}</span>
              <span className="text-muted-foreground">
                {level.count}
                {level.capacity > 0 ? ` / ${level.capacity}` : ""}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  level.fillRate !== null && level.fillRate >= 90
                    ? "bg-destructive"
                    : "bg-primary"
                )}
                style={{ width: `${(level.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
