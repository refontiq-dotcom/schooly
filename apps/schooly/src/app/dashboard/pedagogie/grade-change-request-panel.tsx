"use client"

import { useCallback, useEffect, useState } from "react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import type { GradeEntryRow } from "./actions"
import { decideGradeChange, listPendingGradeChangeRequests, type GradeChangeRequest } from "./grade-correction-actions"

function fmt(value: number | null) {
  return value === null ? "ABS" : String(value)
}

export function GradeChangeRequestPanel({ grades }: { grades: GradeEntryRow[] }) {
  const [requests, setRequests] = useState<GradeChangeRequest[]>([])
  const [message, setMessage] = useState("")
  const [decisionRequest, setDecisionRequest] = useState<{ id: string; approve: boolean } | null>(null)

  const load = useCallback(async () => {
    const result = await listPendingGradeChangeRequests()
    if (result.error) setMessage(result.error)
    else setRequests(result.data ?? [])
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <section className="space-y-3 rounded border border-amber-300/60 bg-amber-50/50 p-4 dark:bg-amber-950/20">
      <div>
        <h2 className="text-xl font-semibold">🔔 Modifications de notes en attente</h2>
        <p className="text-sm text-muted-foreground">
          Une demande informatique ne change jamais une note seule. Seul le professeur habilité peut la confirmer.
        </p>
      </div>
      {message && <p className="rounded border p-2 text-sm">{message}</p>}
      {requests.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
      {requests.map(request => {
        const grade = grades.find(g => g.id === request.grade_id)
        const student = grade?.enrollments?.students
        return (
          <div key={request.id} className="rounded border bg-background p-4">
            <div className="grid gap-1 text-sm">
              <strong>{student?.last_name} {student?.first_name} · {grade?.subjects?.name ?? "Matière"}</strong>
              <span>{grade?.label ?? "Évaluation"} · révision {request.old_revision}</span>
              <span className="font-medium">{fmt(request.old_value)} → {fmt(request.new_value)}{grade?.max_value ? ` / ${grade.max_value}` : ""}</span>
              <span>Demandée le {new Date(request.requested_at).toLocaleString("fr-FR")}</span>
              <span>Demandeur : {request.requester_name ?? request.requested_by}</span>
              <span>Professeur : {request.teacher_name ?? "Professeur habilité"}</span>
              <span>Motif de la demande : {request.reason}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setDecisionRequest({ id: request.id, approve: true })}>Confirmer la modification</Button>
              <Button type="button" variant="outline" onClick={() => setDecisionRequest({ id: request.id, approve: false })}>Refuser</Button>
            </div>
          </div>
        )
      })}
      {decisionRequest && (
        <div className="rounded border bg-background p-4">
          <h3 className="font-semibold">{decisionRequest.approve ? "Motif de confirmation" : "Motif du refus"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Ce motif sera conservé dans l’historique de la demande.</p>
          <ActionForm action={async form => { const result = await decideGradeChange(form); if (!result.error) { setDecisionRequest(null); await load() } return result }} className="mt-3 space-y-3">
            <input type="hidden" name="requestId" value={decisionRequest.id} />
            <input type="hidden" name="decision" value={decisionRequest.approve ? "approve" : "reject"} />
            <textarea name="decisionReason" required minLength={1} maxLength={2000} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={decisionRequest.approve ? "Ex. Vérification du relevé papier..." : "Ex. La pièce justificative ne correspond pas..."} />
            <div className="flex gap-2"><Button type="submit">{decisionRequest.approve ? "Confirmer" : "Enregistrer le refus"}</Button><Button type="button" variant="ghost" onClick={() => setDecisionRequest(null)}>Annuler</Button></div>
          </ActionForm>
        </div>
      )}
    </section>
  )
}
