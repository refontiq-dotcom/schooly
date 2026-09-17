"use client"

import { useState } from "react"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { GradeEntryRow } from "./actions"
import { correctGradeEntry, getGradeCorrections, type GradeCorrection } from "./grade-correction-actions"

export function GradeCorrectionPanel({ grade, locked, onSaved }: {
  grade: GradeEntryRow; locked: boolean; onSaved: () => Promise<void>
}) {
  const [absent, setAbsent] = useState(grade.absence_status === "excused")
  const [history, setHistory] = useState<GradeCorrection[] | null>(null)
  const [message, setMessage] = useState("")
  async function loadHistory() {
    try {
      const result = await getGradeCorrections(grade.id)
      if (result.error) { setMessage(result.error); return }
      setHistory(result.data ?? []); setMessage("")
    } catch { setMessage("Historique indisponible. Réessayez.") }
  }
  return <details className="mt-2 rounded border p-3">
    <summary>Correction et historique</summary>
    {locked ? <p>Correction indisponible : période fermée ou note historique non rattachée.</p> :
      <ActionForm action={async form => {
        try {
          const result = await correctGradeEntry(form)
          if (result.error) return result
          setMessage("Correction enregistrée.")
          await onSaved()
          return {}
        } catch { return { error: "Connexion interrompue. Rechargez la note avant de réessayer." } }
      }} className="my-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="gradeId" value={grade.id} />
        <input type="hidden" name="revision" value={grade.revision} />
        <label>Statut corrigé<select name="absenceStatus" value={absent ? "excused" : "graded"}
          onChange={e => setAbsent(e.target.value === "excused")} className="block w-full rounded border p-2">
          <option value="graded">Noté</option><option value="excused">ABS justifiée</option>
        </select></label>
        <label>Note corrigée /{grade.max_value}<Input key={String(absent)} name="value" type="number" step="0.01"
          min="0" max={grade.max_value} disabled={absent} required={!absent} defaultValue={absent ? "" : grade.value ?? ""} /></label>
        <label>Commentaire corrigé<Input name="comment" defaultValue={grade.comment ?? ""} /></label>
        <label>Motif obligatoire<Input name="reason" required maxLength={2000} /></label>
        <Button type="submit">Enregistrer la correction</Button>
      </ActionForm>}
    <Button type="button" variant="outline" onClick={() => void loadHistory()}>Voir les corrections</Button>
    {message && <p role="status">{message}</p>}
    {history && <ul>{history.length === 0 && <li>Aucune correction.</li>}{history.map(h => <li key={h.id} className="border-t py-2">
      Version {h.revision} : {h.old_status === "excused" ? "ABS" : h.old_value} → {h.new_status === "excused" ? "ABS" : h.new_value}
      {" — "}{h.reason} — {h.corrected_at} — auteur : {h.corrected_by}
      <p>Commentaire : {h.old_comment ?? "Aucun"} → {h.new_comment ?? "Aucun"}</p>
    </li>)}</ul>}
  </details>
}
