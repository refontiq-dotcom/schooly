"use client"

import { useActionState } from "react"
import { ArrowLeft, ArrowRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPasswordAction } from "../unified-actions"

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, { error: null })

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md gemini-glass rounded-2xl p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground">
            Saisissez votre email professionnel. Nous vous enverrons un lien pour créer un nouveau mot de passe.
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
              Si cette adresse correspond à un compte Schooly, un lien de réinitialisation vient d&apos;être envoyé.
              Vérifiez aussi vos courriers indésirables.
            </div>
            <a href="/" className="block text-center text-sm text-primary hover:underline font-medium">
              ← Retour à la connexion
            </a>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email professionnel</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="direction@mon-ecole.ci"
                  required
                  autoComplete="email"
                  className="pl-10 h-11"
                  disabled={pending}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={pending}>
              {pending ? "Envoi…" : "Recevoir le lien"} {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        )}

        <a href="/" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
        </a>
      </div>
    </main>
  )
}
