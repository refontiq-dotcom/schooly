import { useState, useTransition } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  getRolloverPreview,
  executeRollover,
  setEnrollmentDecision,
} from "../../rollover-actions"
import {
  DECISION_LABELS,
  messageFrom,
  type AcademicYear,
  type PreviewRow,
  type RolloverPreview,
  type RolloverResult,
} from "./types"

type RolloverWizardProps = {
  years: AcademicYear[]
  /** Recharge le panneau (années + historique) après exécution. */
  onExecuted: () => void
}

/** Carte de bascule : configuration → prévisualisation → résultat. */
export function RolloverWizard({ years, onExecuted }: RolloverWizardProps) {
  const [preview, setPreview] = useState<RolloverPreview | null>(null)
  const [result, setResult] = useState<RolloverResult | null>(null)

  const [selectedOldYear, setSelectedOldYear] = useState("")
  const [selectedNewYear, setSelectedNewYear] = useState("")
  const [step, setStep] = useState<"config" | "preview" | "done">("config")

  const [isPending, startTransition] = useTransition()
  const [isExecuting, setIsExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const activeYear = years.find((y) => y.status === "en_cours")
  const plannedYears = years.filter((y) => y.status === "planifiee")

  // Pré-sélection de l'année source : l'année en cours sert de défaut tant
  // qu'aucun choix explicite n'a été fait (state dérivé, pas d'effet).
  const sourceYearId = selectedOldYear || activeYear?.id || ""

  const handlePreview = () => {
    if (!sourceYearId) {
      setErrorMsg("Sélectionnez l'année source.")
      return
    }
    setErrorMsg(null)
    startTransition(async () => {
      try {
        const res = await getRolloverPreview(sourceYearId)
        if ("error" in res) {
          setErrorMsg(res.error ?? "Erreur inconnue")
          return
        }
        setPreview(res.data)
        setStep("preview")
      } catch (err) {
        setErrorMsg(messageFrom(err))
      }
    })
  }

  const handleExecute = async () => {
    if (!sourceYearId || !selectedNewYear) {
      setErrorMsg("Sélectionnez les deux années.")
      return
    }
    setErrorMsg(null)
    setIsExecuting(true)
    try {
      const res = await executeRollover(sourceYearId, selectedNewYear)
      if ("error" in res) {
        setErrorMsg(res.error ?? "Erreur inconnue")
        return
      }
      setResult(res.summary)
      setStep("done")
      onExecuted()
    } catch (err) {
      setErrorMsg(messageFrom(err))
    } finally {
      setIsExecuting(false)
    }
  }

  const resetWizard = () => {
    setStep("config")
    setPreview(null)
    setResult(null)
    setSelectedOldYear("")
    setSelectedNewYear("")
  }

  const refreshPreview = () => {
    startTransition(async () => {
      const updated = await getRolloverPreview(sourceYearId)
      if ("error" in updated) {
        setErrorMsg(updated.error ?? "Erreur inconnue")
        return
      }
      setPreview(updated.data)
    })
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-primary" /> Bascule d&apos;année académique
        </CardTitle>
        <CardDescription>
          Réinscrivez automatiquement les élèves pour la nouvelle année selon les décisions du
          conseil de classe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Indicateur de progression */}
        <div className="flex items-center gap-2 text-sm">
          {(["config", "preview", "done"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["config", "preview", "done"].indexOf(step) > i
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s === "config"
                  ? "1. Configuration"
                  : s === "preview"
                    ? "2. Prévisualisation"
                    : "3. Résultat"}
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
                  value={sourceYearId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedOldYear(e.target.value ?? "")
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner…</option>
                  {years
                    .filter((y) => y.status === "en_cours")
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label} (En cours)
                      </option>
                    ))}
                  {years
                    .filter((y) => y.status === "cloturee")
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label} (Clôturée)
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-year">Nouvelle année (destination)</Label>
                <select
                  id="new-year"
                  value={selectedNewYear}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedNewYear(e.target.value ?? "")
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner…</option>
                  {plannedYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
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
              disabled={!sourceYearId || isPending}
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
                {
                  key: "admitted",
                  value: preview.admitted,
                  icon: TrendingUp,
                  color: "text-green-800 bg-green-50 border-green-800/30",
                },
                {
                  key: "repeated",
                  value: preview.repeated,
                  icon: RotateCcw,
                  color: "text-orange-900 bg-orange-50 border-orange-800/30",
                },
                {
                  key: "excluded",
                  value: preview.excluded,
                  icon: XCircle,
                  color: "text-red-700 bg-red-50 border-red-800/30",
                },
                {
                  key: "pending",
                  value: preview.pending,
                  icon: Clock,
                  color: "text-gray-700 bg-gray-50 border-gray-400",
                },
              ].map(({ key, value, icon: Icon, color }) => {
                const d = DECISION_LABELS[key]
                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-3 ${color.split(" ").slice(1).join(" ")}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-bold ${color.split(" ")[0]}`}>{value}</p>
                      <Icon className={`h-5 w-5 ${color.split(" ")[0]}`} />
                    </div>
                    <p className={`text-xs font-medium mt-1 ${color.split(" ")[0]}`}>
                      {d.label}
                    </p>
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
                  {preview.enrollments.map((e) => (
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
                        {renderDecisionCell(
                          e,
                          sourceYearId,
                          isPending,
                          startTransition,
                          setErrorMsg,
                          setPreview,
                        )}
                      </td>
                    </tr>
                  ))}
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
                    const targets = preview.enrollments.filter((e) => e.decision !== "admitted")
                    for (const t of targets) {
                      const res = await setEnrollmentDecision(t.id, sourceYearId, "admitted")
                      if ("error" in res) {
                        setErrorMsg(res.error ?? "Erreur inconnue")
                        return
                      }
                    }
                    const updated = await getRolloverPreview(sourceYearId)
                    if ("error" in updated) {
                      setErrorMsg(updated.error ?? "Erreur inconnue")
                      return
                    }
                    setPreview(updated.data)
                  })
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tout marquer « Admis »
              </Button>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={refreshPreview}>
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
                  (niveau de destination sans parallèle correspondant, ou plusieurs candidats).
                  Sans classe, un élève reste invisible des listes de classe, des moyennes de
                  classe et de l&apos;appel — à affecter au secrétariat après la bascule.
                </span>
              </div>
            )}

            {preview.pending > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{preview.pending} élève(s)</strong> sans décision du conseil seront
                  ignorés lors de la bascule. Complétez leurs décisions dans le module Pédagogie
                  avant de continuer si nécessaire.
                </span>
              </div>
            )}

            {!selectedNewYear && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Vous n&apos;avez pas sélectionné l&apos;année de destination. Retournez à
                l&apos;étape précédente.
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setStep("config")}>
                ← Modifier
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!selectedNewYear || isExecuting}
                className="bg-primary"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Bascule en cours…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" /> Lancer la bascule (
                    {preview.admitted + preview.repeated} élèves)
                  </>
                )}
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
            <Button onClick={resetWizard}>Nouvelle bascule</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Cellule « libellé + select » d'une ligne de prévisualisation. */
function renderDecisionCell(
  e: PreviewRow,
  sourceYearId: string,
  isPending: boolean,
  startTransition: React.TransitionStartFunction,
  setErrorMsg: (msg: string | null) => void,
  setPreview: (preview: RolloverPreview) => void,
) {
  const d = DECISION_LABELS[e.decision]
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${d?.color}`}
      >
        {d?.label ?? e.decision}
      </span>
      <select
        aria-label={`Décision pour ${e.studentName}`}
        value={e.decision}
        disabled={isPending}
        onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
          const decision = ev.target.value as
            | "admitted"
            | "repeated"
            | "excluded"
            | "pending"
          startTransition(async () => {
            const res = await setEnrollmentDecision(e.id, sourceYearId, decision)
            if ("error" in res) {
              setErrorMsg(res.error ?? "Erreur inconnue")
              return
            }
            const updated = await getRolloverPreview(sourceYearId)
            if ("error" in updated) {
              setErrorMsg(updated.error ?? "Erreur inconnue")
              return
            }
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
  )
}
