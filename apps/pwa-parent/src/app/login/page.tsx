"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, Loader2 } from "lucide-react"
import { parentPhoneSignIn, claimParentAccount, type PhoneAuthResult } from "./actions"

type Mode = "signin" | "claim"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("signin")
  const [phone, setPhone] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const show = (r: PhoneAuthResult) => {
    if (r.ok) return true
    setError(r.message)
    setLoading(false)
    return false
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === "claim" && password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }

    setLoading(true)
    const result =
      mode === "signin"
        ? await parentPhoneSignIn(phone, password)
        : await claimParentAccount(phone, password, fullName)

    // claimParentAccount redirige lui-même après création + connexion.
    if (!show(result)) return

    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Schooly — Espace Parent</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Connectez-vous avec le téléphone enregistré par l'école"
              : "Créez votre compte avec votre téléphone d'inscription"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="07 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {mode === "claim" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Votre nom complet</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Ex : Marie Kone"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "claim" ? 8 : undefined}
              />
            </div>

            {mode === "claim" && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            {mode === "signin" ? (
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => { setMode("claim"); setError(null) }}
              >
                Premier accès ? Créer mon compte
              </button>
            ) : (
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => { setMode("signin"); setError(null) }}
              >
                J&apos;ai déjà un compte — me connecter
              </button>
            )}
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {mode === "signin"
              ? "Votre téléphone doit figurer sur une inscription enregistrée par l'école."
              : "Votre numéro doit figurer sur une inscription. Aucun compte n'est créé sans elle."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
