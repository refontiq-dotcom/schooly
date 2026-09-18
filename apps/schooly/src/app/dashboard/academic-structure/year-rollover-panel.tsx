"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
// Années : UNE seule implémentation, celle du module Structure académique
// (actions.ts). Le panneau entretenait sa propre paire getAcademicYears /
// createAcademicYear, avec d'autres noms de champs (start_date vs startDate),
// un statut forcé différent et un filtre deleted_at absent : deux vérités pour
// la même table, deux formulaires de création sur la même page.
import { getAcademicYears } from "./actions"
import {
  canRunRollover,
  getRolloverPreview,
  executeRollover,
  getRolloverLogs,
  setEnrollmentDecision,
} from "./rollover-actions"
import {
  Play,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  TrendingUp,
  XCircle,
  Clock,
  ChevronRight,
  History,
} from "lucide-react"

type AcademicYear = {
  id: string
  label: string
  start_date: string
  end_date: string
  status: string
}

type PreviewRow = {
  id: string
  studentName: string
  className: string
  gradeLevelId?: string
  gradeLevelName: string
  gradeLevelOrder: number
  decision: string
  /** Destination calculée par le même moteur que l'exécution. */
  targetStatus: "skipped" | "graduated" | "enrolled"
  targetClassId: string | null
  targetClassName: string | null
}

type RolloverPreview = {
  total: number
  admitted: number
  repeated: number
  excluded: number
  pending: number
  /** Élèves qui seront réinscrits sans classe (appariement ambigu). */
  withoutClass: number
  graduated: number
  enrollments: PreviewRow[]
}

type RolloverResult = {
  promoted: number
  repeated: number
  excluded: number
  pending: number
  withoutClass: number
  total: number
}

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Session expirée — reconnectez-vous.",
  UNAUTHORIZED: "La bascule d'année est réservée à la direction.",
}

/** Traduit une exception de garde en message affichable (jamais d'écran vide). */
function messageFrom(err: unknown) {
  const raw = err instanceof Error ? err.message : ""
  return ERROR_MESSAGES[raw] ?? (raw || "Une erreur est survenue.")
}

const YEAR_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_cours: { label: "En cours", variant: "default" },
  planifiee: { label: "Planifiée", variant: "secondary" },
  cloturee: { label: "Clôturée", variant: "outline" },
}

const DECISION_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admitted: { label: "Admis", color: "text-green-800 bg-green-50", icon: CheckCircle2 },
  repeated: { label: "Redouble", color: "text-orange-900 bg-orange-50", icon: RotateCcw },
  excluded: { label: "Exclu", color: "text-red-700 bg-red-50", icon: XCircle },
  pending: { label: "En attente", color: "text-gray-700 bg-gray-50", icon: Clock },
}

export function YearRolloverPanel() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [result, setResult] = useState<RolloverResult | null>(null)

  const [selectedOldYear, setSelectedOldYear] = useState("");
  const [selectedNewYear, setSelectedNewYear] = useState("");
  const [step, setStep] = useState<"config" | "preview" | "done">("config")
  const [showHistory, setShowHistory] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [isExecuting, setIsExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // La bascule est réservée à la direction (ROLLOVER_ROLES). Le secretariat
  // peut consulter la page : on teste le droit AVANT d'appeler les actions
  // protégées, qui rejettent — sinon la page restait vide sans explication.
  const [isAllowed, setIsAllowed] = useState(false)
  const [accessMsg, setAccessMsg] = useState<string | null>(null)

  const load = () => {
    startTransition(async () => {
      try {
        const yearsRes = await getAcademicYears()
        if ("data" in yearsRes && yearsRes.data) setYears(yearsRes.data as AcademicYear[])

        const access = await canRunRollover()
        setIsAllowed(access.allowed)
        if (!access.allowed) {
          setAccessMsg(access.error ?? null)
          return
        }
        setAccessMsg(null)

        const logsRes = await getRolloverLogs()
        if ("data" in logsRes && logsRes.data) setLogs(logsRes.data as any[])
      } catch (err) {
        setAccessMsg(messageFrom(err))
      }
    })
  }

  useEffect(() => { load() }, [])

  const activeYear = years.find(y => y.status === "en_cours")
  const plannedYears = years.filter(y => y.status === "planifiee")

  // Pré-sélectionne l'année en cours comme année source dès qu'elle est connue
  useEffect(() => {
    if (!selectedOldYear && activeYear) setSelectedOldYear(activeYear.id)
  }, [activeYear, selectedOldYear])

  const handlePreview = async () => {
    if (!selectedOldYear) { setErrorMsg("Sélectionnez l'année source."); return }
    setErrorMsg(null)
    startTransition(async () => {
      try {
        const res = await getRolloverPreview(selectedOldYear)
        if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
        setPreview(res.data)
        setStep("preview")
      } catch (err) {
        setErrorMsg(messageFrom(err))
      }
    })
  }

  const handleExecute = async () => {
    if (!selectedOldYear || !selectedNewYear) { setErrorMsg("Sélectionnez les deux années."); return }
    setErrorMsg(null)
    setIsExecuting(true)
    try {
      const res = await executeRollover(selectedOldYear, selectedNewYear)
      if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
      setResult(res.summary)
      setStep("done")
      load()
    } catch (err) {
      setErrorMsg(messageFrom(err))
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      {accessMsg && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">Bascule non disponible</p>
              <p className="mt-0.5">{accessMsg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Années académiques (lecture seule : la gestion est dans l'onglet « Années ») */}
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
            <p className="text-center py-6 text-muted-foreground text-sm">Aucune année configurée.</p>
          ) : (
            <div className="space-y-2">
              {years.map(year => {
                const cfg = YEAR_STATUS_CONFIG[year.status] ?? { label: year.status, variant: "outline" }
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

      {/* Bascule d'année */}
      {isAllowed && (
        <>
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" /> Bascule d'année académique
          </CardTitle>
          <CardDescription>
            Réinscrivez automatiquement les élèves pour la nouvelle année selon les décisions du conseil de classe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Indicateur de progression */}
          <div className="flex items-center gap-2 text-sm">
            {(["config", "preview", "done"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  step === s ? "bg-primary text-primary-foreground"
                  : (["config", "preview", "done"].indexOf(step) > i) ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
                }`}>                  {s === "config" ? "1. Configuration" : s === "preview" ? "2. Prévisualisation" : "3. Résultat"}
                </span>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
            </div>
          )}

          {/* Étape 1 : Configuration */}
          {step === "config" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="old-year">Année source (à clore)</Label>
                  <select
                    id="old-year"
                    value={selectedOldYear}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOldYear(e.target.value ?? "")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner…</option>
                    {years.filter(y => y.status === "en_cours").map(y => (
                      <option key={y.id} value={y.id}>{y.label} (En cours)</option>
                    ))}
                    {years.filter(y => y.status === "cloturee").map(y => (
                      <option key={y.id} value={y.id}>{y.label} (Clôturée)</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-year">Nouvelle année (destination)</Label>
                  <select
                    id="new-year"
                    value={selectedNewYear}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedNewYear(e.target.value ?? "")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner…</option>
                    {plannedYears.map(y => (
                      <option key={y.id} value={y.id}>{y.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {plannedYears.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  Aucune année planifiée. Créez d&apos;abord la prochaine année académique depuis
                  l&apos;onglet « Années » avant de lancer la bascule.
                </div>
              )}

              <Button
                onClick={handlePreview}
                disabled={!selectedOldYear || isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Prévisualiser la bascule
              </Button>
            </div>
          )}

          {/* Étape 2 : Prévisualisation */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Résumé statistique */}
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { key: "admitted", value: preview.admitted, icon: TrendingUp, color: "text-green-800 bg-green-50 border-green-800/30" },
                  { key: "repeated", value: preview.repeated, icon: RotateCcw, color: "text-orange-900 bg-orange-50 border-orange-800/30" },
                  { key: "excluded", value: preview.excluded, icon: XCircle, color: "text-red-700 bg-red-50 border-red-800/30" },
                  { key: "pending", value: preview.pending, icon: Clock, color: "text-gray-700 bg-gray-50 border-gray-400" },
                ].map(({ key, value, icon: Icon, color }) => {
                  const d = DECISION_LABELS[key]
                  return (
                    <div key={key} className={`rounded-lg border p-3 ${color.split(" ").slice(1).join(" ")}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${color.split(" ")[0]}`}>{value}</p>
                        <Icon className={`h-5 w-5 ${color.split(" ")[0]}`} />
                      </div>
                      <p className={`text-xs font-medium mt-1 ${color.split(" ")[0]}`}>{d.label}</p>
                    </div>
                  )
                })}
              </div>

              {/* Liste des élèves — décisions saisissables sans quitter la bascule */}
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Élève</th>
                      <th className="text-left py-2 px-3 font-medium">Classe actuelle</th>
                      <th className="text-left py-2 px-3 font-medium">Destination</th>
                      <th className="text-left py-2 px-3 font-medium">Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.enrollments.map(e => {
                      const d = DECISION_LABELS[e.decision]
                      return (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{e.studentName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{e.className}</td>
                          <td className="py-2 px-3">
                            {e.targetStatus === "graduated" ? (
                              <span className="text-muted-foreground">Diplômé(e)</span>
                            ) : e.targetStatus === "skipped" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : e.targetClassName ? (
                              <span>{e.targetClassName}</span>
                            ) : (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                                sans classe
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${d?.color}`}>
                                {d?.label ?? e.decision}
                              </span>
                              <select
                                aria-label={`Décision pour ${e.studentName}`}
                                value={e.decision}
                                disabled={isPending}
                                onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
                                  const decision = ev.target.value as "admitted" | "repeated" | "excluded" | "pending"
                                  startTransition(async () => {
                                    const res = await setEnrollmentDecision(e.id, selectedOldYear, decision)
                                    if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
                                    const updated = await getRolloverPreview(selectedOldYear)
                                    if ("error" in updated) { setErrorMsg(updated.error ?? "Erreur inconnue"); return }
                                    setPreview(updated.data)
                                  })
                                }}
                                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              >
                                <option value="admitted">Admis</option>
                                <option value="repeated">Redouble</option>
                                <option value="excluded">Exclu</option>
                                <option value="pending">En attente</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions groupées : tout marquer Admis / réinitialiser */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const targets = preview.enrollments.filter(e => e.decision !== "admitted")
                      for (const t of targets) {
                        const res = await setEnrollmentDecision(t.id, selectedOldYear, "admitted")
                        if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
                      }
                      const updated = await getRolloverPreview(selectedOldYear)
                      if ("error" in updated) { setErrorMsg(updated.error ?? "Erreur inconnue"); return }
                      setPreview(updated.data)
                    })
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tout marquer « Admis »
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const updated = await getRolloverPreview(selectedOldYear)
                      if ("error" in updated) { setErrorMsg(updated.error ?? "Erreur inconnue"); return }
                      setPreview(updated.data)
                    })
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Rafraîchir
                </Button>
              </div>

              {preview.graduated > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{preview.graduated} élève(s)</strong> seront considérés comme{" "}
                    <strong>diplômés</strong> (aucun rang supérieur au leur) et ne seront pas
                    réinscrits. Vérifiez que le rang de leur niveau est bien le plus élevé de
                    l&apos;école et que les niveaux sont numérotés du plus petit au plus grand.
                  </span>
                </div>
              )}

              {preview.withoutClass > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{preview.withoutClass} élève(s)</strong> seront réinscrits{" "}
                    <strong>sans classe</strong> : le parallèle n&apos;a pas pu être déterminé
                    (niveau de destination sans parallèle correspondant, ou plusieurs
                    candidats). Sans classe, un élève reste invisible des listes de classe, des
                    moyennes de classe et de l&apos;appel — à affecter au secrétariat après la
                    bascule.
                  </span>
                </div>
              )}

              {preview.pending > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{preview.pending} élève(s)</strong> sans décision du conseil seront ignorés lors de la bascule.
                    Complétez leurs décisions dans le module Pédagogie avant de continuer si nécessaire.
                  </span>
                </div>
              )}

              {!selectedNewYear && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  Vous n'avez pas sélectionné l'année de destination. Retournez à l'étape précédente.
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setStep("config")}>← Modifier</Button>
                <Button
                  onClick={handleExecute}
                  disabled={!selectedNewYear || isExecuting}
                  className="bg-primary"
                >
                  {isExecuting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Bascule en cours…</>
                    : <><Play className="h-4 w-4 mr-2" /> Lancer la bascule ({preview.admitted + preview.repeated} élèves)</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Étape 3 : Résultat */}
          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-800 shrink-0" />
                <div>
                  <p className="font-semibold text-green-900">Bascule réussie !</p>
                  <p className="text-sm text-green-900">
                    {result.promoted} promu(s) · {result.repeated} redoublant(s) ·{" "}
                    {result.excluded} exclu(s) · {result.pending} sans décision
                  </p>
                  {result.withoutClass > 0 && (
                    <p className="text-sm font-medium text-amber-700">
                      {result.withoutClass} élève(s) sans classe — à affecter depuis l&apos;onglet
                      Classes.
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => { setStep("config"); setPreview(null); setResult(null); setSelectedOldYear(""); setSelectedNewYear("") }}>
                Nouvelle bascule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer"
          onClick={() => setShowHistory(f => !f)}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" /> Historique des bascules
          </CardTitle>
          <span className="text-xs text-muted-foreground">{showHistory ? "Masquer" : "Afficher"}</span>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Aucune bascule effectuée.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">
                        {log.old_year?.label} → {log.new_year?.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Par {log.initiator?.full_name ?? "—"} · {new Date(log.initiated_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.status === "completed" ? "default" : "destructive"}>
                        {log.status === "completed" ? "Réussie" : "Échouée"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        +{log.students_promoted} · ↺{log.students_repeated} · ✕{log.students_excluded}
                        {(log.students_without_class ?? 0) > 0
                          ? ` · ⚑${log.students_without_class} sans classe`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
        </>
      )}
    </div>
  )
}
