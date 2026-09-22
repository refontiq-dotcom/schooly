import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatFCFA } from "@/lib/formatters"
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CreditCard,
  Wallet,
} from "lucide-react"
import type { DirectionDashboard } from "../dashboard-data"

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  check: "Chèque",
  transfer: "Virement",
  autre: "Autre",
}

export function TopDebtors({ data }: { data: DirectionDashboard["finance"] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-destructive/10 p-1.5">
            <Wallet className="h-4 w-4 text-destructive" />
          </span>
          Reste à recouvrer
        </CardTitle>
        <CardDescription>
          {formatFCFA(data.outstanding)} sur {data.debtorsCount} élève
          {data.debtorsCount > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.topDebtors.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun impayé sur l’année en cours.
          </p>
        )}
        {data.topDebtors.map((debtor) => (
          <div
            key={debtor.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{debtor.name}</p>
              <p className="text-xs text-muted-foreground">
                {debtor.matricule ?? "Sans matricule"}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-destructive">
              {formatFCFA(debtor.balance)}
            </span>
          </div>
        ))}
        <Link
          href="/dashboard/direction/finance/reminders"
          className="flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
        >
          Lancer des relances <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function CashWidget({ cash }: { cash: DirectionDashboard["cash"] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-lg p-1.5",
                cash.isOpen
                  ? "bg-green-600/10 text-green-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Wallet className="h-4 w-4" />
            </span>
            Caisse
          </span>
          <Badge
            variant="outline"
            className={cn(
              cash.isOpen
                ? "border-green-600 text-green-600"
                : "text-muted-foreground"
            )}
          >
            {cash.isOpen ? "Ouverte" : "Fermée"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {cash.isOpen && cash.openedAt
            ? `Ouverte le ${new Date(cash.openedAt).toLocaleString("fr-FR")}`
            : "Aucune session de caisse en cours."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fond de caisse</span>
          <span className="font-mono">{formatFCFA(cash.openingAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Encaissé en session</span>
          <span className="font-mono text-green-600">
            {formatFCFA(cash.collectedInSession)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-medium">Attendu en caisse</span>
          <span className="font-mono font-semibold">
            {formatFCFA(cash.expectedInSession)}
          </span>
        </div>
        {!cash.isOpen && cash.lastClosedAt && (
          <p className="text-xs text-muted-foreground">
            Dernière clôture : écart de{" "}
            <span
              className={cn(
                "font-medium",
                (cash.lastDifference ?? 0) === 0
                  ? "text-green-600"
                  : "text-destructive"
              )}
            >
              {formatFCFA(cash.lastDifference ?? 0)}
            </span>
          </p>
        )}
        <Link
          href={cash.isOpen ? "/dashboard/caisse/close" : "/dashboard/caisse"}
          className="flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
        >
          {cash.isOpen ? "Clôturer la caisse" : "Ouvrir une session"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function PaymentChart({ daily }: { daily: DirectionDashboard["finance"]["daily"] }) {
  const max = Math.max(...daily.map((day) => day.total), 1)
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-blue-600/10 p-1.5">
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </span>
          Encaissements des {daily.length} derniers jours
        </CardTitle>
        <CardDescription>
          Total : {formatFCFA(daily.reduce((sum, day) => sum + day.total, 0))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-end gap-1.5">
          {daily.map((day) => (
            <div
              key={day.date}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${new Date(`${day.date}T00:00:00`).toLocaleDateString("fr-FR")} · ${formatFCFA(day.total)}`}
            >
              <div
                className={cn(
                  "w-full rounded-t transition-colors",
                  day.total > 0
                    ? "bg-primary/70 group-hover:bg-primary"
                    : "bg-muted"
                )}
                style={{ height: `${Math.max(2, (day.total / max) * 100)}%` }}
              />
              <span className="hidden text-[10px] text-muted-foreground sm:block">
                {new Date(`${day.date}T00:00:00`).getDate()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function MethodBreakdown({ data }: { data: DirectionDashboard["finance"] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-green-600/10 p-1.5">
            <CreditCard className="h-4 w-4 text-green-600" />
          </span>
          Modes d’encaissement de l’année
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.byMethod.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Aucun encaissement enregistré.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.byMethod.map((method) => (
              <div key={method.method} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {METHOD_LABELS[method.method] ?? method.method}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {formatFCFA(method.total)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
