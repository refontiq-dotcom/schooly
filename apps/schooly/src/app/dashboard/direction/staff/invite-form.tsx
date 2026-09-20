"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { inviteStaffMember } from "./actions"
import { STAFF_ROLE_CODES, STAFF_ROLE_LABELS } from "./staff-roles"

export function InviteStaffForm() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function close() {
    if (pending) return
    setOpen(false)
  }

  function resetMessages() {
    setError(null)
    setCreated(null)
    setAdded(null)
  }

  async function onSubmit(formData: FormData) {
    setPending(true)
    resetMessages()
    const result = await inviteStaffMember(formData)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.data?.created) {
      setCreated({ email: result.data.email, password: result.data.password })
    } else if (result.data) {
      setAdded(result.data.email)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => { resetMessages(); setOpen(true) }}>
        <Plus className="h-4 w-4" />
        Ajouter un membre
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>Ajouter un membre</DialogTitle>
          <DialogDescription>
            Un mot de passe est généré s&apos;il n&apos;est pas saisi — à transmettre à la personne.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" name="fullName" required placeholder="Kouassi Ama" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="ama@ecole.ci" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="roleCode">Rôle</Label>
              <select
                id="roleCode"
                name="roleCode"
                defaultValue="professeur"
                disabled={pending}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
              >
                {STAFF_ROLE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {STAFF_ROLE_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Mot de passe (optionnel)</Label>
              <Input id="password" name="password" type="text" placeholder="Généré si vide" disabled={pending} />
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-base font-medium text-destructive">
              {error}
            </p>
          ) : null}
          {created ? (
            <p className="rounded-lg border bg-muted/60 p-3 text-base leading-relaxed">
              Compte prêt pour <span className="font-medium">{created.email}</span>. Mot de passe à transmettre :
              <span className="ml-1 font-mono font-semibold">{created.password}</span>
            </p>
          ) : null}
          {added ? (
            <p className="rounded-lg border bg-muted/60 p-3 text-base leading-relaxed">
              <span className="font-medium">{added}</span> a été rattaché à l&apos;établissement.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              {created || added ? "Fermer" : "Annuler"}
            </Button>
            {!created && !added ? (
              <Button type="submit" disabled={pending}>
                {pending ? "Ajout…" : "Ajouter au personnel"}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
