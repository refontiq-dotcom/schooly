"use client"

import { useActionState } from "react"
import { Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPasswordAction } from "../unified-actions"

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPasswordAction, { error: null })

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md gemini-glass rounded-2xl p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Choisissez un nouveau mot de passe d&apos;au moins 8 caractères.
          </p>
        </div>

        {state.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {state.error}
          </div>
        )}

        {state.success ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              Votre mot de passe a été modifié avec succès.
            </div>
            <a href="/" className="block text-center text-sm text-primary hover:underline font-medium">
              Se connecter →
            </a>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" required className="pl-10 h-11" disabled={pending} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Retapez votre mot de passe" required className="pl-10 h-11" disabled={pending} />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"} {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
