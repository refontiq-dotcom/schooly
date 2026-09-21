"use client"

import { useActionState } from "react"
import Link from "next/link"
import { School, ArrowRight, Building2, User, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerSchoolAction } from "./actions"

const initialState = {
  error: null,
}

export default function RegisterSchoolPage() {
  const [state, formAction, isPending] = useActionState(registerSchoolAction, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl shadow-xl border border-border">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-4">
            <School className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Créer votre école</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Inscrivez votre établissement et commencez la gestion numérique en quelques secondes.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">Nom de l'établissement</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="schoolName" name="schoolName" placeholder="Ex: Lycée Classique d'Abidjan" type="text" required className="pl-10 h-11" disabled={isPending} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet du Directeur</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" name="fullName" placeholder="Ex: M. Touré Amadou" type="text" required className="pl-10 h-11" disabled={isPending} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email professionnel</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" name="email" placeholder="direction@mon-ecole.ci" type="email" required className="pl-10 h-11" disabled={isPending} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" name="password" type="password" required className="pl-10 h-11" disabled={isPending} />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              name="legalAccepted"
              required
              disabled={isPending}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-muted-foreground leading-5">
              J’ai lu et j’accepte les{" "}
              <Link href="/legal/conditions" target="_blank" className="font-medium text-primary hover:underline">
                Conditions Générales de Service
              </Link>{" "}
              et la{" "}
              <Link href="/legal/confidentialite" target="_blank" className="font-medium text-primary hover:underline">
                Politique de confidentialité
              </Link>{" "}
              de Schooly.
            </span>
          </label>

          {state.error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base group" disabled={isPending}>
            {isPending ? "Création en cours..." : "Créer mon espace"}
            {!isPending && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}
