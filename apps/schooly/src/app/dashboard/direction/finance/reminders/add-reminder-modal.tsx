"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ActionForm } from "@/components/action-form"
import { sendPaymentReminder } from "@/app/dashboard/finance/moratoriums/actions"
import { toast } from "sonner"
import { Bell } from "lucide-react"

/**
 * Modale « Nouvelle relance » : la page Relances ne montre que l'historique,
 * le formulaire élève × type × canal vit ici.
 */
export function AddReminderModal({
  enrollments,
  onSuccess,
}: {
  enrollments: Array<{ id: string; matricule: string | null; label: string }>
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<string>("email")

  async function handleSubmit(formData: FormData) {
    const result = await sendPaymentReminder(formData)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Relance envoyée !")
    setOpen(false)
    onSuccess?.()
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4 mr-2" /> Nouvelle relance
      </Button>
      <Dialog open={open} onOpenChange={setOpen} label="Envoyer une relance de paiement">
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Nouvelle relance</DialogTitle>
          <DialogDescription>
            Préventive (J-5), formelle (J+1), avertissement (J+7) ou restriction d&apos;accès.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <ActionForm action={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rem-enrollment">Élève *</Label>
                <select id="rem-enrollment" name="enrollmentId" required className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Sélectionner</option>
                  {enrollments.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rem-type">Type de relance</Label>
                <Select name="reminderType" required>
                  <SelectTrigger id="rem-type">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Préventive (J-5)</SelectItem>
                    <SelectItem value="formal">Formelle (J+1)</SelectItem>
                    <SelectItem value="warning">Avertissement (J+7)</SelectItem>
                    <SelectItem value="access_restriction">Restriction d&apos;accès</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rem-channel">Canal</Label>
                <Select name="channel" value={channel} onValueChange={setChannel} required>
                  <SelectTrigger id="rem-channel">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push">Push PWA</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Envoyer la relance</Button>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
