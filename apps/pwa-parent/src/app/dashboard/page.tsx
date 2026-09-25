"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/browser"
import { getDashboardData, type ParentDashboardData } from "./actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertCircle,
  BookOpen,
  CreditCard,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react"

const XOF = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
})

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function appreciation(note: number | null) {
  if (note === null) return null
  if (note >= 16) return "Très bien"
  if (note >= 14) return "Bien"
  if (note >= 12) return "Assez bien"
  if (note >= 10) return "Passable"
  return "Insuffisant"
}

const ERROR_LABELS: Record<string, string> = {
  UNAUTHENTICATED: "Session expirée, reconnectez-vous.",
  NO_GUARDIAN_PROFILE:
    "Aucun profil parent n'est associé à cet email. Contactez l'école pour l'enregistrer.",
  DB_ERROR: "Une erreur est survenue. Réessayez plus tard.",
}

export default function ParentDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<ParentDashboardData | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("")
  const [offline, setOffline] = useState(false)

  const load = useCallback((enrollmentId: string) => {
    startTransition(async () => {
      const result = await getDashboardData(enrollmentId || undefined)
      if (result.ok) {
        setData(result.data)
        setErrorCode(null)
        if (result.data.selectedChild && result.data.selectedChild.enrollmentId !== enrollmentId) {
          setSelectedEnrollmentId(result.data.selectedChild.enrollmentId)
        }
      } else {
        setErrorCode(result.code)
      }
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login")
    })

    const onOnline = () => setOffline(!navigator.onLine)
    onOnline()
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOnline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOnline)
    }
  }, [router])

  useEffect(() => {
    load("")
  }, [load])

  if (errorCode) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{ERROR_LABELS[errorCode] ?? errorCode}</p>
          {errorCode === "UNAUTHENTICATED" ? (
            <Button onClick={() => router.replace("/login")}>Se reconnecter</Button>
          ) : (
            <Button variant="outline" onClick={() => load(selectedEnrollmentId)}>
              <RefreshCw className="h-4 w-4" /> Réessayer
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
      </div>
    )
  }

  const { selectedChild, finance, homeworks, grades, generalAverage, moratoriums } = data
  const pendingMoratorium = moratoriums.find((m) => m.status === "pending")

  return (
    <div className="space-y-5">
      {offline && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <WifiOff className="h-4 w-4" /> Mode hors-ligne — données possiblement obsolètes
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">Bonjour, {data.guardianName}</h1>
        {data.children.length === 0 ? (
          <p className="mt-2 rounded-lg bg-card p-4 text-sm text-muted-foreground">
            Aucun enfant rattaché à votre compte. Contactez le secrétariat de l&apos;école.
          </p>
        ) : (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {data.children.map((c) => (
              <button
                key={c.enrollmentId}
                onClick={() => {
                  setSelectedEnrollmentId(c.enrollmentId)
                  load(c.enrollmentId)
                }}
                disabled={isPending}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
                  selectedChild?.enrollmentId === c.enrollmentId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {c.studentName} · {c.className ?? c.gradeLevel}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedChild && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-semibold">{selectedChild.studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedChild.schoolName} · {selectedChild.className ?? selectedChild.gradeLevel} ·{" "}
                  {selectedChild.yearLabel}
                  {selectedChild.yearStatus === "cloturee" && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      Année clôturée — consultation
                    </Badge>
                  )}
                </p>
                {selectedChild.matricule && (
                  <p className="text-xs text-muted-foreground">Matricule {selectedChild.matricule}</p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/bulletin?enrollment=${selectedChild.enrollmentId}`}>
                  <GraduationCap className="h-4 w-4" /> Bulletin
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* FINANCE */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CreditCard className="h-4 w-4 text-primary" /> Ma facturation
              </h2>
              <Badge
                variant="outline"
                className={
                  (finance?.pending ?? 0) > 0
                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                }
              >
                {finance?.feeStatus === "moratoire"
                  ? "Moratoire en cours"
                  : finance?.feeStatus === "avance"
                    ? "Avance enregistrée"
                    : (finance?.pending ?? 0) > 0
                      ? "Reste à payer"
                      : "À jour"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card className="py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Total dû</p>
                  <p className="mt-1 text-lg font-bold">{XOF.format(finance?.totalDue ?? 0)}</p>
                </CardContent>
              </Card>
              <Card className="py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Payé</p>
                  <p className="mt-1 text-lg font-bold text-primary">{XOF.format(finance?.totalPaid ?? 0)}</p>
                </CardContent>
              </Card>
              <Card className="py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Reste</p>
                  <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                    {XOF.format(finance?.pending ?? 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Échéancier : tranches attendues, allocation FIFO des paiements */}
            {(finance?.schedule?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Échéancier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {finance?.schedule.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.dueDate ? `Échéance ${formatDate(t.dueDate)}` : "Sans échéance"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">{XOF.format(t.amount)}</p>
                        <p
                          className={`text-xs ${
                            t.remaining > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {t.remaining > 0 ? `Reste ${XOF.format(t.remaining)}` : "Payée"}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(finance?.pending ?? 0) > 0 && !pendingMoratorium && (
              <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Difficulté à payer ? Demandez un délai de paiement.
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/moratorium">Demander un moratoire</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {pendingMoratorium && (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="text-sm">
                    <Badge variant="secondary">Moratoire en cours</Badge>
                    <p className="mt-1 text-muted-foreground">
                      {pendingMoratorium.reason} — échéance {formatDate(pendingMoratorium.dueDate)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/dashboard/moratorium">Voir le suivi</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-primary" /> Paiements & reçus
                </CardTitle>
                <CardDescription>
                  Dernier paiement : {formatDate(finance?.lastPaymentAt ?? null)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {finance && finance.payments.length > 0 ? (
                  finance.payments.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{XOF.format(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.receivedAt)} · {p.reference ?? p.method}
                        </p>
                      </div>
                      <Badge variant="outline">{p.method}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Aucun paiement enregistré pour le moment.
                  </p>
                )}
                {finance && finance.receipts.length > 0 && (
                  <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                    <FileText className="mr-1 inline h-3.5 w-3.5" />
                    Reçu le plus récent : <strong>{finance.receipts[0].receiptNumber}</strong> (vérification : {finance.receipts[0].verificationCode})
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* CAHIER DE TEXTE */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="h-4 w-4 text-primary" /> Cahier de texte
            </h2>
            {homeworks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aucun devoir publié pour la classe.
                </CardContent>
              </Card>
            ) : (
              homeworks.slice(0, 8).map((h) => (
                <Card key={h.id} className="py-4">
                  <CardContent className="flex flex-wrap items-start justify-between gap-2 px-4">
                    <div>
                      <p className="text-sm font-medium">{h.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.subject}
                        {h.teacher ? ` · ${h.teacher}` : ""}
                      </p>
                      {h.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary">À faire avant le {formatDate(h.dueDate)}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {/* NOTES */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" /> Notes
              </h2>
              {generalAverage !== null && (
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{generalAverage.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground"> / 20</span>
                  <p className="text-xs text-muted-foreground">{appreciation(generalAverage)}</p>
                </div>
              )}
            </div>
            {grades.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aucune note saisie pour le moment.
                </CardContent>
              </Card>
            ) : (
              <Card className="py-2">
                <CardContent className="divide-y px-4 py-0">
                  {grades.map((g) => {
                    const note = (g.value / g.maxValue) * 20
                    const app = appreciation(note)
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium">{g.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.subject} · coef. {g.weight}
                            {g.comment ? ` · ${g.comment}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold ${
                              note >= 10 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {g.value.toFixed(2)}/{g.maxValue}
                          </p>
                          {app && <p className="text-xs text-muted-foreground">{app}</p>}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
