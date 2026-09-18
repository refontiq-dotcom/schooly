"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cancelPayment } from "@/app/dashboard/finance/actions"
import { RotateCcw } from "lucide-react"

/**
 * Annulation d'un encaissement (erreur de saisie) — direction / compta.
 * Motif obligatoire : la ligne reste en base (soft delete) pour l'audit,
 * le reçu correspondant est invalidé et les soldes se recalculent seuls.
 */
export function CancelPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await cancelPayment(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Encaissement annulé — le reçu correspondant est invalidé.")
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Annuler cet encaissement"
      >
        <RotateCcw className="h-4 w-4 text-destructive" />
      </Button>
    )
  }

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Input
        name="cancelReason"
        required
        minLength={5}
        placeholder="Motif (erreur de saisie…)"
        className="h-8 w-44 text-xs"
        autoFocus
      />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        Confirmer
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
        Garder
      </Button>
    </form>
  )
}
