"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { activateMovement, type ActivationResult } from "./actions"

function Submit() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>
    {pending ? "Activation…" : "Activer TRF pour 60 jours"}
  </Button>
}

export function ActivationForm({ requestId }: { requestId: string }) {
  const [result, setResult] = useState<ActivationResult | null>(null)
  if (result) return <p role="status">
    {result.status === "EXPIRED" ? "Activation expirée, non renouvelée" : "Activation administrative enregistrée"}
    {" — "}{result.tracking_code}. Échéance : {new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan",
    }).format(new Date(result.expires_at))}. Aucun quitus ni droit d’importation accordé.
  </p>
  return <ActionForm action={async form => {
    try {
      const response = await activateMovement(form)
      if (response.data) setResult(response.data)
      return response
    } catch {
      return { error: "Activation non confirmée. Rechargez la page pour vérifier son état avant de réessayer." }
    }
  }} className="mt-3 space-y-2">
    <input type="hidden" name="requestId" value={requestId} />
    <p>Activation administrative uniquement, sans quitus ni autorisation d’importation. La validité ne peut pas être prolongée.</p>
    <Submit />
  </ActionForm>
}
