import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp } from "lucide-react"

export const TONE_CLASSES: Record<string, string> = {
  primary: "text-primary bg-primary/10",
  green: "text-green-600 bg-green-600/10",
  blue: "text-blue-600 bg-blue-600/10",
  amber: "text-amber-600 bg-amber-600/10",
  red: "text-destructive bg-destructive/10",
}

function TrendPill({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">Nouveau</span>
  }
  const up = value >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-green-600" : "text-destructive"
      )}
    >
      <TrendingUp className={cn("h-3.5 w-3.5", !up && "rotate-180")} />
      {up ? "+" : ""}
      {value.toFixed(1)} %
    </span>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  trend,
  progress,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: keyof typeof TONE_CLASSES
  hint?: React.ReactNode
  trend?: number | null
  progress?: number
}) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn("rounded-lg p-1.5", TONE_CLASSES[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend !== undefined && <TrendPill value={trend} />}
        </div>
        {progress !== undefined && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                progress >= 80
                  ? "bg-green-600"
                  : progress >= 50
                    ? "bg-amber-500"
                    : "bg-destructive"
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  )
}
