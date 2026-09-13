"use client"

import { useActionState } from "react"
import { unlockStudentPortal, type UnlockState } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, QrCode } from "lucide-react"

export function QrUnlockForm() {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    unlockStudentPortal,
    {}
  )

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <QrCode className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Espace élève</CardTitle>
        <CardDescription>
          Saisissez le code d&apos;accès remis par la vie scolaire pour consulter votre cahier de
          texte et vos notes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code d&apos;accès</Label>
            <Input
              id="code"
              name="code"
              placeholder="Ex. SCH-2026-XXXX"
              autoComplete="off"
              required
            />
          </div>
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Déverrouiller
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
