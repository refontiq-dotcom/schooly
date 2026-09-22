"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { ActionForm } from "@/components/action-form"

/**
 * Enveloppe un Server Action de création pour recharger la liste concernée
 * après un succès : l'état local de cette page cliente ne se rafraîchit pas
 * tout seul (`revalidatePath` ne concerne que le rendu serveur), les listes
 * restaient donc figées jusqu'à un rechargement manuel.
 */
export function withReload(
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>,
  reload: () => Promise<void>,
) {
  return async (formData: FormData) => {
    const result = await action(formData)
    if (!result?.error) await reload()
    return result
  }
}

export function ArchiveButton({
  action,
  id,
  title,
  confirmMessage,
  onDone,
}: {
  action: (id: string) => Promise<{ error?: string }>
  id: string
  title: string
  confirmMessage: string
  onDone: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (isPending) return
    setOpen(false)
    setError(null)
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        title={title}
        aria-label={title}
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{confirmMessage}</DialogDescription>
        </DialogHeader>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <DialogFooter className="mt-6 gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>Annuler</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const res = await action(id)
                if (res?.error) {
                  setError(res.error)
                  return
                }
                await onDone()
                setOpen(false)
              })
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

export function EditDialog({
  title,
  action,
  onDone,
  children,
}: {
  title: string
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>
  onDone: () => Promise<void>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" variant="ghost" title="Modifier" aria-label="Modifier" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Corrigez les champs puis enregistrez.</DialogDescription>
        </DialogHeader>
        <ActionForm
          action={async (formData) => {
            const result = await action(formData)
            if (!result?.error) {
              await onDone()
              setOpen(false)
            }
            return result
          }}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </ActionForm>
      </Dialog>
    </>
  )
}

export function CreateDialog({
  title,
  description,
  action,
  triggerLabel,
  children,
  open: openProp,
  onOpenChange,
}: {
  title: string
  description: string
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>
  triggerLabel: string
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ActionForm
          action={async (formData) => {
            const result = await action(formData)
            if (!result?.error) setOpen(false)
            return result
          }}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </ActionForm>
      </Dialog>
    </>
  )
}
