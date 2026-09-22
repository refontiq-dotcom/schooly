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

  const load = useCallback(async () => {
    const result = await listPendingGradeChangeRequests()
    if (result.error) setMessage(result.error)
    else setRequests(result.data ?? [])
  }

  useEffect(() => { void load() }, [])

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
              <span>Motif : {request.reason}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionForm action={async form => {
                const result = await decideGradeChange(form)
                if (!result.error) await load()
                return result
              }}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit">Confirmer la modification</Button>
              </ActionForm>
              <ActionForm action={async form => {
                const result = await decideGradeChange(form)
                if (!result.error) await load()
                return result
              }}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="decision" value="reject" />
                <Button type="submit" variant="outline">Refuser</Button>
              </ActionForm>
            </div>
          </div>
        )
      })}
    </section>
  )
}
