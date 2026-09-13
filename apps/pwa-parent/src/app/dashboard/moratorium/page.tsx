"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  getDashboardData,
  requestMoratorium,
  type MoratoriumItem,
  type ParentDashboardData,
} from "../actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, Clock, Loader2, Send } from "lucide-react"

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-primary text-primary-foreground">Approuvé</Badge>
  if (status === "rejected") return <Badge variant="destructive">Refusé</Badge>
  if (status === "completed") return <Badge variant="secondary">Terminé</Badge>
  if (status === "cancelled") return <Badge variant="outline">Annulé</Badge>
  return <Badge className="bg-amber-500 text-white">En attente</Badge>
}

export default function MoratoriumPage() {
  const [data, setData] = useState<ParentDashboardData | null>(null)
  const [enrollmentId, setEnrollmentId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await getDashboardData()
      if (result.ok) setData(result.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFeedback(null)
    const fd = new FormData()
    fd.set("enrollmentId", enrollmentId)
    fd.set("reason", reason)
    fd.set("requestedAmount", amount)
    fd.set("notes", notes)

    startTransition(async () => {
      const result = await requestMoratorium(fd)
      if (result.ok) {
        setFeedback({
          type: "ok",
          text: "Demande envoyée. La direction vous répondra dans les prochains jours.",
        })
        setReason("")
        setAmount("")
        setNotes("")
        load()
      } else {
        setFeedback({
          type: "err",
          text:
            result.code === "VALIDATION"
              ? (result.message ?? "Formulaire incomplet.")
              : result.code === "NOT_YOUR_CHILD"
                ? "Cet enfant n'est pas rattaché à votre compte."
                : "Erreur lors de l'envoi. Réessayez.",
        })
      }
    })
  }

  const children = data?.children ?? []
  const moratoriums: MoratoriumItem[] = data?.moratoriums ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Demande de moratoire</h1>
        <p className="text-sm text-muted-foreground">
          Solde impayé ? L&apos;école peut accorder un délai ou un échelonnement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" /> Nouvelle demande
          </CardTitle>
          <CardDescription>Réponse de la direction sous 3 à 5 jours ouvrés.</CardDescription>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun enfant rattaché à votre compte.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enrollmentId">Enfant</Label>
                <Select value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} required>
                  <option value="" disabled hidden>Sélectionner un enfant</option>
                  {children.map((c) => (
                    <option key={c.enrollmentId} value={c.enrollmentId}>
                      {c.studentName} — {c.className ?? c.gradeLevel}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Montant sollicité (FCFA)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="Ex. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motif</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex. Perte d'emploi, dépense médicale imprévue…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Précisions (facultatif)</Label>
                <Textarea
                  id="notes"
                  placeholder="Proposition d'échéancier, documents justificatifs…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {feedback && (
                <p
                  className={`rounded-md px-3 py-2 text-sm ${
                    feedback.type === "ok"
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {feedback.text}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending || loading}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer la demande"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Mes demandes</h2>
        {moratoriums.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Clock className="h-8 w-8 opacity-40" />
              Aucune demande pour le moment.
            </CardContent>
          </Card>
        ) : (
          moratoriums.map((m) => (
            <Card key={m.id} className="py-4">
              <CardContent className="space-y-1 px-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={m.status} />
                  <span className="text-xs text-muted-foreground">
                    Demande du {new Date(m.requestedAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <p className="text-sm font-medium">{m.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Sollicité : {new Intl.NumberFormat("fr-FR").format(m.requestedAmount)} FCFA
                  {m.approvedAmount !== null
                    ? ` · Accordé : ${new Intl.NumberFormat("fr-FR").format(m.approvedAmount)} FCFA`
                    : ""}
                  {" · "}
                  Échéance : {new Date(m.dueDate).toLocaleDateString("fr-FR")}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
        Un moratoire n&apos;annule pas la dette : il rééchelonne le paiement.{" "}
        <Link href="/dashboard" className="underline">
          Retour au tableau de bord
        </Link>
      </p>
    </div>
  )
}
