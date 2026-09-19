import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ActionForm } from "@/components/action-form"
import { getFinanceOverview, getFinanceConfig, generateMissingFeeItems, generateDueReminders } from "@/app/dashboard/finance/actions"
import { FeeScheduleManager, type ScheduleRow } from "./fee-schedule-manager"
import { AddFeeScheduleModal } from "./add-fee-schedule-modal"
import { DuplicateFeeScheduleModal } from "./duplicate-fee-schedule-modal"
import { SiblingDiscountModal } from "./sibling-discount-modal"
import { AlertTriangle, CalendarClock, Landmark, PieChart, Wallet } from "lucide-react"
import { IntelligentGuidance } from "@/components/intelligent-guidance"

export default async function FinancePage() {
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
    .single()

  if (!roleData?.school_id) redirect("/login")
  const schoolId = roleData.school_id as string

  const [overviewRes, configRes] = await Promise.all([
    getFinanceOverview(schoolId),
    getFinanceConfig(schoolId),
  ])

  const overview = overviewRes.data
  const config = configRes.data

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Solde de chaque élève en temps réel, encaissements et recouvrement
        </p>
      </div>

      <IntelligentGuidance items={[
        ...((overview?.unpaidCount ?? 0) > 0 ? [{ id: "unpaid", title: `${overview?.unpaidCount ?? 0} élève(s) ont encore un solde`, description: "Schooly détecte des impayés et peut vous guider vers les relances avant une éventuelle demande de moratoire.", severity: "action" as const, actionLabel: "Gérer les relances", href: "/dashboard/direction/finance/reminders" }] : []),
        ...((overview?.upcomingDue?.length ?? 0) > 0 ? [{ id: "due", title: "Des échéances arrivent dans les 7 prochains jours", description: "Préparez les relances préventives avant la date d’échéance.", severity: "warning" as const, actionLabel: "Voir les relances", href: "/dashboard/direction/finance/reminders" }] : []),
        ...(config && config.schedules.length === 0 ? [{ id: "tariff", title: "La grille tarifaire n’est pas encore configurée", description: "Sans tarif, Schooly ne peut pas calculer correctement le dû et le solde des inscriptions.", severity: "critical" as const, actionLabel: "Configurer les tarifs", href: "/dashboard/direction/finance" }] : []),
        ...(!overview?.openCashSession ? [{ id: "cash", title: "La caisse est fermée", description: "Si des encaissements doivent être réalisés aujourd’hui, ouvrez une session avant de commencer.", severity: "info" as const, actionLabel: "Ouvrir la caisse", href: "/dashboard/caisse" }] : []),
      ]} />

      {/* KPI réels — plus de cartes factices */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Encaissé aujourd&apos;hui
            </div>
            <p className="text-2xl font-bold mt-1">
              {(overview?.todayTotal ?? 0).toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overview?.todayCount ?? 0} opération(s) · ce mois :{" "}
              {(overview?.monthTotal ?? 0).toLocaleString("fr-FR")} FCFA
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PieChart className="h-4 w-4" /> Taux de recouvrement
            </div>
            <p className="text-2xl font-bold mt-1">
              {overview?.collectionRate != null ? `${overview.collectionRate} %` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payé {(overview?.paidTotal ?? 0).toLocaleString("fr-FR")} / attendu{" "}
              {(overview?.expectedTotal ?? 0).toLocaleString("fr-FR")} FCFA
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Impayés
            </div>
            <p className="text-2xl font-bold mt-1 text-orange-700">
              {(overview?.unpaidAmount ?? 0).toLocaleString("fr-FR")} FCFA
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overview?.unpaidCount ?? 0} élève(s) — sur {overview?.enrollmentCount ?? 0} inscrit(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Landmark className="h-4 w-4" /> Statut caisse
            </div>
            {overview?.openCashSession ? (
              <>
                <p className="text-2xl font-bold mt-1 text-green-700">Ouverte</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Depuis {new Date(overview.openCashSession.opened_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {Array.isArray(overview.openCashSession.users) && overview.openCashSession.users[0]?.full_name
                    ? ` — ${overview.openCashSession.users[0].full_name}`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-1 text-muted-foreground">Fermée</p>
                <p className="text-xs text-muted-foreground mt-0.5">Aucune session en cours</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impayés + échéances de la semaine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Top impayés
            </CardTitle>
            <CardDescription>Les 10 plus gros soldes restant à recouvrer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(overview?.topUnpaid ?? []).map((r) => (
                <div key={r.enrollment_id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">
                      {r.last_name} {r.first_name}
                      <span className="text-muted-foreground font-normal"> · {r.grade_level_name ?? "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.matricule || "sans matricule"}
                      {r.guardian_phone ? ` · ${r.guardian_phone}` : ""}
                    </p>
                  </div>
                  <span className="font-mono font-semibold text-orange-700">
                    {r.balance.toLocaleString("fr-FR")} F
                  </span>
                </div>
              ))}
              {(overview?.topUnpaid ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun impayé — tous les élèves dotés d&apos;un échéancier sont à jour.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Échéances des 7 prochains jours
            </CardTitle>
            <CardDescription>Tranches à encaisser bientôt (relance à prévoir)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(overview?.upcomingDue ?? []).map((r) => (
                <div key={r.enrollment_id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">{r.last_name} {r.first_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Échéance {r.next_due_date ? new Date(r.next_due_date).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                  <span className="font-mono font-semibold">
                    {(r.next_due_amount ?? r.balance).toLocaleString("fr-FR")} F
                  </span>
                </div>
              ))}
              {(overview?.upcomingDue ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune échéance dans les 7 prochains jours.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gestion de la grille tarifaire (ajout / duplication / suppression) */}
      {config ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Grille tarifaire ({config.schedules.length} ligne(s))</CardTitle>
              <CardDescription>
                Niveau × profil financier × année. Les tarifs servent à générer le « dû » de chaque élève.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AddFeeScheduleModal
                profiles={config.profiles}
                gradeLevels={config.gradeLevels}
                years={config.years}
              />
              <DuplicateFeeScheduleModal years={config.years} />
            </div>
          </CardHeader>
          <CardContent>
            <FeeScheduleManager schedules={config.schedules} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-destructive">{configRes.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Réductions & relances intelligentes */}
      {config && config.years.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Remises fratrie (en masse)</CardTitle>
              <CardDescription>
                Détecte les parents de 2+ enfants et applique la remise au 2e et suivants (par matricule). Idempotent.
                Aucun taux n&apos;est imposé : toutes les écoles ne pratiquent pas la remise fratrie.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <SiblingDiscountModal academicYearId={config.years[0]?.id ?? ""} />
                <span className="text-xs text-muted-foreground">
                  Parents de 2+ enfants → remise au 2e et suivants.
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relances automatiques (WhatsApp)</CardTitle>
              <CardDescription>
                File notification_outbox : J-5 préventif, J0 le jour même, J+1 formel, J+7 avertissement. Anti-doublon par échéance et palier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <ActionForm action={generateDueReminders}>
                  <Button type="submit" variant="secondary">Générer les relances du jour</Button>
                </ActionForm>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <a href="/dashboard/direction/finance/reminders">Voir l&apos;historique</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rattrapage : générer les échéanciers des inscriptions sans tarif */}
      {config && config.years.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Échéanciers manquants</CardTitle>
            <CardDescription>
              Génère le « dû » des élèves déjà inscrits sans échéancier (à partir de la grille ci-dessus). Idempotent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={generateMissingFeeItems} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="genYearId">Année académique</Label>
                <Select name="academicYearId" required defaultValue={config.years[0]?.id}>
                  <SelectTrigger id="genYearId" ariaLabel="Année académique">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="secondary">Générer les échéanciers manquants</Button>
            </ActionForm>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href="/dashboard/direction/finance/moratoriums">Gérer les moratoires</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
