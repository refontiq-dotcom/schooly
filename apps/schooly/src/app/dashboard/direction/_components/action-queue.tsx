import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { DirectionDashboard } from "../dashboard-data"

/**
 * File des décisions en attente. Secondaire : les entrées à zéro sont
 * filtrées (progressive disclosure) — seul l'état « tout est à jour »
 * est affiché quand la file est vide.
 */
export function ActionQueue({ items }: { items: DirectionDashboard["actionQueue"] }) {
  const pending = items.filter((item) => item.count > 0)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-amber-500/10 p-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </span>
          Actions requises
        </CardTitle>
        <CardDescription>
          Ce qui attend une décision ou une validation de votre part.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.length === 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Aucune action en attente. Tout est à jour.
          </div>
        )}
        {pending.map((item) => {
          const tone =
            item.tone === "danger"
              ? "text-destructive bg-destructive/10"
              : item.tone === "warning"
                ? "text-amber-600 bg-amber-600/10"
                : "text-blue-600 bg-blue-600/10"
          const Icon =
            item.key === "pre_enrollments"
              ? Users
              : item.key === "moratoriums"
                ? Clock
                : item.key === "dropout_alerts"
                  ? AlertCircle
                  : item.key === "notifications"
                    ? Bell
                    : ShieldCheck
          const body = (
            <>
              <span className={cn("rounded-lg p-2", tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.label}
                </span>
                {item.detail && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </span>
              <span className="text-lg font-bold tabular-nums">{item.count}</span>
              {item.href && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </>
          )
          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
            >
              {body}
            </Link>
          ) : (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {body}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
