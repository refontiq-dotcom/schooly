"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { prepareMovement } from "./actions"

export type MovementEnrollment = { id: string; label: string; matricule: string | null }

function Submit() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le brouillon"}</Button>
}

export function MovementForm({ enrollments }: { enrollments: MovementEnrollment[] }) {
  const [kind, setKind] = useState("TRF")
  const [message, setMessage] = useState("")
  return <ActionForm action={async form => {
    setMessage("")
    const result = await prepareMovement(form)
    if (!result.error) setMessage("Brouillon enregistré. Aucun transfert ni changement financier effectué.")
    return result
  }} className="space-y-4">
    <label className="block">Inscription active
      <select name="enrollmentId" required className="block w-full rounded border p-2">
        <option value="">Choisir l’inscription et l’année</option>
        {enrollments.map(e => <option key={e.id} value={e.id}>{e.label} — matricule : {e.matricule ?? "non renseigné"}</option>)}
      </select>
    </label>
    <label className="block">Type de mouvement
      <select name="kind" value={kind} onChange={e => setKind(e.target.value)} className="block w-full rounded border p-2">
        <option value="TRF">TRF — Transfert volontaire</option>
        <option value="ORT">ORT — Orientation à vérifier</option>
      </select>
    </label>
    <label className="block">Motif<Input name="reason" required minLength={3} maxLength={500} /></label>
    {kind === "ORT" && <fieldset className="space-y-3 rounded border p-4">
      <legend>Administratif &amp; Bourses — déclarations non vérifiées</legend>
      <p>Le matricule national provient de l’inscription. Ces informations ne constituent pas une certification et n’activent aucun tarif « Affecté ».</p>
      <label className="block">Référence de décision<Input name="decisionReference" required maxLength={150} /></label>
      <label className="block">Autorité émettrice<Input name="issuingAuthority" required maxLength={150} /></label>
      <label className="block">Statut de bourse déclaré
        <select name="scholarshipStatus" required className="block w-full rounded border p-2" defaultValue="inconnu">
          <option value="inconnu">À vérifier</option><option value="boursier">Boursier</option><option value="non_boursier">Non-boursier</option>
        </select>
      </label>
    </fieldset>}
    <Submit />
    {message && <p role="status">{message}</p>}
  </ActionForm>
}
