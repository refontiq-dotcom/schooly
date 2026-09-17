"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isValidMovementCode, movementKind, normalizeMovementCode } from "@/lib/movements/code"
import { importMovement, type ImportOption } from "./actions"

export type ImportResult = { enrollmentId: string }

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending || disabled}>
    {pending ? "Importation…" : "Confirmer l’importation"}
  </Button>
}

/** Contrôle local : évite un aller-retour serveur pour une faute de frappe. */
function codeFeedback(raw: string) {
  const code = normalizeMovementCode(raw)
  if (code.length === 0) return null
  if (code.length < 8) return { tone: "pending" as const, text: `Code incomplet (${code.length}/8).` }
  if (!isValidMovementCode(code)) return { tone: "invalid" as const, text: "Code invalide : vérifiez la saisie." }
  return movementKind(code) === "ORT"
    ? { tone: "orientation" as const, text: "Affecté par l’État — import non disponible pour le moment." }
    : { tone: "valid" as const, text: "Transfert privé — code reconnu, en attente du contrôle serveur." }
}

export function ImportForm({ classes, years }: { classes: ImportOption[]; years: ImportOption[] }) {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const feedback = codeFeedback(code)
  const blocked = !isValidMovementCode(code) || movementKind(code) === "ORT"

  if (result) return <div className="space-y-3 rounded border p-4">
    <p role="status">Importation enregistrée. Une nouvelle inscription a été créée dans votre établissement ; l’inscription d’origine est conservée.</p>
    <p className="text-sm">Identifiant de l’inscription créée : <strong>{result.enrollmentId}</strong></p>
    <p className="text-sm">Complétez maintenant le dossier depuis les inscriptions : profil financier, documents et affectations.</p>
  </div>

  return <ActionForm action={async form => {
    const response = await importMovement(form)
    if (response.data) setResult(response.data)
    return response
  }} className="space-y-4">
    <label className="block">Code de la fiche de transfert
      <Input name="trackingCode" required maxLength={12} autoComplete="off" value={code}
        onChange={event => setCode(normalizeMovementCode(event.target.value))} placeholder="TRF0123E" />
    </label>
    {feedback && <p role={feedback.tone === "invalid" ? "alert" : "status"}>{feedback.text}</p>}
    <label className="block">Classe d’accueil
      <select name="classId" required className="block w-full rounded border p-2">
        <option value="">Choisir la classe</option>
        {classes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
    <label className="block">Année scolaire d’accueil
      <select name="academicYearId" required className="block w-full rounded border p-2">
        <option value="">Choisir l’année</option>
        {years.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
    <p className="text-sm">Le contrôle final est effectué par le serveur : code activé et non expiré, établissement autorisé par la direction de départ, code non encore utilisé.</p>
    <Submit disabled={blocked} />
  </ActionForm>
}