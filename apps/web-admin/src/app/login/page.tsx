"use client"

import { useActionState } from "react"
import { loginAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, { error: null })

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* En-tête */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground text-2xl font-bold">S</span>
            </div>
          </div>
          <Badge variant="outline" className="text-primary border-primary">Schooly — Espace Administratif</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Connexion</h1>
          <p className="text-muted-foreground">Accédez à votre tableau de bord de gestion scolaire.</p>
        </div>

        {/* Formulaire */}
        <Card className="shadow-xl border-border/50">
          <form action={formAction}>
            <CardHeader>
              <CardTitle className="text-lg">Identifiants de service</CardTitle>
              <CardDescription>Utilisez l'email et le mot de passe fournis par votre administrateur.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Message d'erreur */}
              {state.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
                  {state.error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="directeur@votre-ecole.ci"
                  className="h-12 text-base"
                  autoComplete="email"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="h-12 text-base"
                  autoComplete="current-password"
                  disabled={isPending}
                />
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={isPending}
              >
                {isPending ? "Connexion en cours…" : "Se connecter →"}
              </Button>
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-xs text-center text-muted-foreground">
                  Problème de connexion ? Contactez votre responsable informatique.
                </p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Nouveau sur Schooly ? </span>
                  <a href="/register-school" className="text-primary hover:underline font-medium">
                    Créer mon école
                  </a>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
