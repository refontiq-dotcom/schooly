import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatFCFA } from "@/lib/formatters"
import { IntelligentGuidance } from "@/components/intelligent-guidance"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import {
  getDirectionDashboard,
  type DirectionDashboard,
} from "./dashboard-data"

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  check: "Chèque",
  transfer: "Virement",
  autre: "Autre",
}

const TONE_CLASSES: Record<string, string> = {
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

function StatCard({
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

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="rounded-full bg-primary/10 p-3">
          <GraduationCap className="h-6 w-6 text-primary" />
        </span>
        <div className="space-y-1">
          <h3 className="font-semibold">Votre établissement n’est pas encore configuré</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Créez votre année académique, vos niveaux et vos classes, puis
            inscrivez vos premiers élèves pour voir vos indicateurs apparaître.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/academic-structure"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <GraduationCap className="h-4 w-4" /> Structurer l’établissement
          </Link>
          <Link
            href="/dashboard/direction/admissions"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Users className="h-4 w-4" /> Inscrire des élèves
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function DirectionIntelligence({ dashboard }: { dashboard: DirectionDashboard }) {
  const crowded = dashboard.students.byLevel.filter(level => (level.fillRate ?? 0) >= 90)
  const pending = dashboard.actionQueue.filter(item => item.count > 0)
  const items = [
    ...(!dashboard.activeYear ? [{ id: "year", title: "Aucune année académique active", description: "La plupart des opérations pédagogiques et administratives dépendent d’une année en cours.", severity: "critical" as const, actionLabel: "Préparer la structure", href: "/dashboard/academic-structure" }] : []),
    ...(crowded.length > 0 ? [{ id: "capacity", title: `${crowded.length} niveau(x) approchent de la capacité disponible`, description: "Schooly détecte un risque de saturation à partir des effectifs et capacités configurés. Vérifiez les classes avant de nouvelles admissions.", severity: "warning" as const, actionLabel: "Voir la structure", href: "/dashboard/academic-structure" }] : []),
    ...(dashboard.finance.recoveryRate < 80 && dashboard.finance.debtorsCount > 0 ? [{ id: "recovery", title: "Le recouvrement mérite une action préventive", description: `${dashboard.finance.debtorsCount} élève(s) présentent encore un solde. Schooly vous propose de traiter les relances avant que les impayés ne s’aggravent.`, severity: "warning" as const, actionLabel: "Gérer les relances", href: "/dashboard/direction/finance/reminders" }] : []),
    ...(pending.length > 0 ? [{ id: "queue", title: `${pending.length} décision(s) attendent votre intervention`, description: "Traitez d’abord les éléments en attente pour éviter qu’ils ne bloquent les étapes suivantes.", severity: "action" as const, actionLabel: "Voir les actions", href: "#actions-requises" }] : []),
  ]
  return <IntelligentGuidance items={items} title="Schooly anticipe les prochaines actions" />
}

function ActionQueue({ items }: { items: DirectionDashboard["actionQueue"] }) {
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

function TopDebtors({ data }: { data: DirectionDashboard["finance"] }) {
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

function CashWidget({ cash }: { cash: DirectionDashboard["cash"] }) {
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

function PaymentChart({ daily }: { daily: DirectionDashboard["finance"]["daily"] }) {
  const max = Math.max(...daily.map((day) => day.total), 1)
  return (
    <Card className="shadow-sm lg:col-span-2">
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

function LevelBreakdown({
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

function MethodBreakdown({ data }: { data: DirectionDashboard["finance"] }) {
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

export default async function DirectionDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const schoolId =
    roleData?.school_id ??
    (user.app_metadata?.school_id as string | undefined)

  if (!schoolId) redirect("/login")

  const cookieStore = await cookies()
  const preferredYearId =
    cookieStore.get("active_academic_year_id")?.value ?? null

  const dashboard = await getDirectionDashboard(admin, schoolId, {
    preferredYearId,
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilotage de l’établissement
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dashboard.activeYear && (
            <Badge variant="outline" className="border-primary text-primary">
              Année {dashboard.activeYear.label}
            </Badge>
          )}
          {dashboard.previousYear && (
            <Badge variant="ghost">
              Comparé à {dashboard.previousYear.label}
            </Badge>
          )}
        </div>
      </div>

      {!dashboard.hasData ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Élèves inscrits"
              value={dashboard.students.active.toLocaleString("fr-FR")}
              icon={Users}
              tone="primary"
              trend={dashboard.students.deltaPercent}
              hint={`${dashboard.students.newThisMonth} nouvelle(s) inscription(s) ce mois`}
            />
            <StatCard
              label="Encaissé ce mois"
              value={formatFCFA(dashboard.finance.collectedThisMonth)}
              icon={CreditCard}
              tone="green"
              trend={dashboard.finance.collectedDeltaPercent}
              hint={`Mois précédent : ${formatFCFA(dashboard.finance.collectedPreviousMonth)}`}
            />
            <StatCard
              label="Taux de recouvrement"
              value={`${dashboard.finance.recoveryRate.toFixed(0)} %`}
              icon={TrendingUp}
              tone="blue"
              progress={dashboard.finance.recoveryRate}
              hint={`${formatFCFA(dashboard.finance.collectedThisYear)} encaissés sur ${formatFCFA(dashboard.finance.expectedThisYear)} attendus`}
            />
            <StatCard
              label="Reste à recouvrer"
              value={formatFCFA(dashboard.finance.outstanding)}
              icon={AlertCircle}
              tone="amber"
              hint={`${dashboard.finance.debtorsCount} élève(s) avec un solde`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div id="actions-requises"><DirectionIntelligence dashboard={dashboard} />
      <ActionQueue items={dashboard.actionQueue} /></div>
            <TopDebtors data={dashboard.finance} />
            <CashWidget cash={dashboard.cash} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PaymentChart daily={dashboard.finance.daily} />
            <LevelBreakdown levels={dashboard.students.byLevel} />
          </div>

          <MethodBreakdown data={dashboard.finance} />
        </>
      )}
    </div>
  )
}
