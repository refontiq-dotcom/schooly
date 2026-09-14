"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ActionForm } from "@/components/action-form"
import {
  getAcademicYears,
  createAcademicYear,
  activateAcademicYear,
  getRolloverPreview,
  executeRollover,
  getRolloverLogs,
  setEnrollmentDecision,
} from "./rollover-actions"
import {
  CalendarDays,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Users,
  TrendingUp,
  XCircle,
  Clock,
  Plus,
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

type RolloverPreview = {
  total: number
  admitted: number
  repeated: number
  excluded: number
  pending: number
  enrollments: Array<{
    id: string
    studentName: string
    className: string
    gradeLevelId?: string
    gradeLevelName: string
    gradeLevelOrder: number
    decision: string
  }>
}

type RolloverResult = {
  promoted: number
  repeated: number
  excluded: number
  pending: number
  total: number
}

const YEAR_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_cours: { label: "En cours", variant: "default" },
  planifiee: { label: "Planifiée", variant: "secondary" },
  cloturee: { label: "Clôturée", variant: "outline" },
}

const DECISION_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admitted: { label: "Admis", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  repeated: { label: "Redouble", color: "text-orange-600 bg-orange-50", icon: RotateCcw },
  excluded: { label: "Exclu", color: "text-red-600 bg-red-50", icon: XCircle },
  pending: { label: "En attente", color: "text-gray-600 bg-gray-50", icon: Clock },
}

export function YearRolloverPanel() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [result, setResult] = useState<RolloverResult | null>(null)

  const [selectedOldYear, setSelectedOldYear] = useState("");
  const [selectedNewYear, setSelectedNewYear] = useState("");
  const [step, setStep] = useState<"config" | "preview" | "done">("config")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [isExecuting, setIsExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = () => {
    startTransition(async () => {
      const [yearsRes, logsRes] = await Promise.all([getAcademicYears(), getRolloverLogs()])
      if ("data" in yearsRes) setYears(yearsRes.data as AcademicYear[])
      if ("data" in logsRes) setLogs(logsRes.data as any[])
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
      const res = await getRolloverPreview(selectedOldYear)
      if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
      setPreview(res.data)
      setStep("preview")
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
    } finally {
      setIsExecuting(false)
    }
  }

  const handleActivate = async (yearId: string) => {
    const res = await activateAcademicYear(yearId)
    if ("error" in res) { setErrorMsg(res.error ?? "Erreur inconnue"); return }
    load()
  }

  return (
    <div className="space-y-6">
      {/* Années académiques */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Années académiques
            </CardTitle>
            <CardDescription>Gérez le cycle scolaire de votre établissement.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(f => !f)}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle année
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateForm && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <ActionForm
                action={async (fd) => {
                  const r = await createAcademicYear(fd)
                  if (r && !("ok" in r)) return r as any
                  load()
                  setShowCreateForm(false)
                }}
                className="grid gap-3 sm:grid-cols-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="year-label">Libellé *</Label>
                  <Input id="year-label" name="label" placeholder="2026-2027" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="year-start">Début *</Label>
                  <Input id="year-start" name="start_date" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="year-end">Fin *</Label>
                  <Input id="year-end" name="end_date" type="date" required />
                </div>
                <div className="sm:col-span-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>Annuler</Button>
                  <Button type="submit" size="sm">Créer</Button>
                </div>
              </ActionForm>
            </div>
          )}

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
                      {year.status === "planifiee" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(year.id)}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" /> Activer
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bascule d'année */}
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
                }`}>
                  {s === "config" ? "1. Configuration" : s === "preview" ? "2. Prévisualisation" : "3. Résultat"}
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
                  Aucune année planifiée. Créez d'abord la prochaine année académique ci-dessus avant de lancer la bascule.
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
                  { key: "admitted", value: preview.admitted, icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200" },
                  { key: "repeated", value: preview.repeated, icon: RotateCcw, color: "text-orange-600 bg-orange-50 border-orange-200" },
                  { key: "excluded", value: preview.excluded, icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
                  { key: "pending", value: preview.pending, icon: Clock, color: "text-gray-600 bg-gray-50 border-gray-200" },
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
                      <th className="text-left py-2 px-3 font-medium">Classe</th>
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
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Bascule réussie !</p>
                  <p className="text-sm text-green-700">
                    {result.promoted} promu(s) · {result.repeated} redoublant(s) ·{" "}
                    {result.excluded} exclu(s) · {result.pending} sans décision
                  </p>
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
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
