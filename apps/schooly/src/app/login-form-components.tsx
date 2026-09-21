import { ArrowRight, Mail, Lock, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type State = {
  error: string | null
  success?: boolean
  mode?: "password" | "activation_verify" | "password_setup"
  contact?: string
}

export function SchoolLoginForm({
  state,
  action,
  pending,
  activationVerifyAction,
  activationVerifyState,
  activationVerifyPending,
  completeActivationAction,
  completeActivationState,
  completeActivationPending,
}: {
  state: State
  action: (fd: FormData) => void
  pending: boolean
  activationVerifyAction: (fd: FormData) => void
  activationVerifyState: State
  activationVerifyPending: boolean
  completeActivationAction: (fd: FormData) => void
  completeActivationState: State
  completeActivationPending: boolean
}) {
  const mode = completeActivationState.mode ?? activationVerifyState.mode ?? state.mode ?? "password"
  const contact = completeActivationState.contact ?? activationVerifyState.contact ?? state.contact ?? ""

  if (mode === "activation_verify") {
    return (
      <div className="gemini-glass rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Activation de votre compte</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Un code de vérification vient d&apos;être envoyé à votre contact professionnel.
          </p>
        </div>

        {state.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{state.error}</div>}
        {activationVerifyState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{activationVerifyState.error}</div>}

        <form action={activationVerifyAction} className="space-y-4">
          <input type="hidden" name="contact" value={contact} />
          <div className="space-y-2">
            <Label htmlFor="staff-code">Code de vérification</Label>
            <Input id="staff-code" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" required className="h-11 text-center text-lg tracking-[0.35em]" disabled={activationVerifyPending} />
          </div>
          <Button type="submit" className="w-full h-11 font-semibold" disabled={activationVerifyPending}>
            {activationVerifyPending ? "Vérification…" : "Vérifier le code"} {!activationVerifyPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <button type="button" onClick={() => window.location.reload()} className="w-full text-xs text-muted-foreground hover:text-foreground">
          ← Recommencer avec un autre contact
        </button>
      </div>
    )
  }

  if (mode === "password_setup") {
    return (
      <div className="gemini-glass rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Créez votre mot de passe</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Votre identité est vérifiée. Choisissez maintenant le mot de passe que vous utiliserez pour vos prochaines connexions.
          </p>
        </div>

        {completeActivationState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{completeActivationState.error}</div>}

        <form action={completeActivationAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="staff-new-password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" required className="pl-10 h-11" disabled={completeActivationPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-confirm-password">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="staff-confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Retapez votre mot de passe" required className="pl-10 h-11" disabled={completeActivationPending} />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 font-semibold" disabled={completeActivationPending}>
            {completeActivationPending ? "Activation…" : "Activer mon compte"} {!completeActivationPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <form action={action} className="gemini-glass rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Connexion établissement</h2>
        <p className="text-xs text-muted-foreground">
          Saisissez votre email professionnel ou votre numéro de téléphone. Schooly déterminera automatiquement la prochaine étape.
        </p>
      </div>

      {state.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{state.error}</div>}

      <div className="space-y-2">
        <Label htmlFor="school-contact">Email professionnel ou téléphone</Label>
        <div className="relative">
          <UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="school-contact"
            name="contact"
            type="text"
            placeholder="direction@mon-ecole.ci ou +225 07..."
            required
            className="pl-10 h-11"
            disabled={pending}
            autoComplete="username"
            defaultValue={contact}
          />
        </div>
      </div>

      {state.mode === "password" && (
        <div className="space-y-2">
          <Label htmlFor="school-password">Mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="school-password" name="password" type="password" placeholder="••••••••" required className="pl-10 h-11" disabled={pending} autoComplete="current-password" />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={pending}>
        {pending ? "Vérification…" : state.mode === "password" ? "Se connecter" : "Continuer"} {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
        <Mail className="h-3.5 w-3.5" />
        <span>Un nouveau collaborateur active son compte par code de vérification.</span>
      </div>

      {state.mode === "password" && (
        <div className="text-center pt-0">
          <a href="/login/forgot-password" className="text-xs text-primary hover:underline font-medium">
            Mot de passe oublié ?
          </a>
        </div>
      )}

      <div className="text-center pt-1">
        <span className="text-xs text-muted-foreground">Nouveau sur Schooly ? </span>
        <a href="/register-school" className="text-xs text-primary hover:underline font-medium">Créer votre établissement →</a>
      </div>
    </form>
  )
}

export function ParentLoginForm(p: {
  step: "send" | "verify"; setStep: (s: "send" | "verify") => void;
  contact: string; setContact: (c: string) => void;
  sendState: State; sendAction: (fd: FormData) => void; sendPending: boolean;
  verifyState: State; verifyAction: (fd: FormData) => void; verifyPending: boolean;
}) {
  return (
    <div className="gemini-glass rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{p.step === "send" ? "Espace Parent" : "Vérification"}</h2>
        <p className="text-xs text-muted-foreground">{p.step === "send" ? "Connectez-vous avec votre email. Aucun mot de passe nécessaire." : "Entrez le code reçu par email."}</p>
      </div>
      {p.step === "send" && (
        <form action={(fd) => { p.setContact(fd.get("email") as string); p.sendAction(fd); if (!p.sendState.error) p.setStep("verify"); }} className="space-y-4">
          {p.sendState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{p.sendState.error}</div>}
          <div className="space-y-2">
            <Label htmlFor="parent-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="parent-email" name="email" type="email" placeholder="parent@email.com" required className="pl-10 h-11" disabled={p.sendPending} defaultValue={p.contact} />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={p.sendPending}>
            {p.sendPending ? "Envoi…" : "Recevoir le code"} {!p.sendPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      )}
      {p.step === "verify" && (
        <form action={p.verifyAction} className="space-y-4">
          {p.verifyState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{p.verifyState.error}</div>}
          <input type="hidden" name="email" value={p.contact} />
          <div className="space-y-2">
            <Label htmlFor="parent-code">Code de vérification</Label>
            <Input id="parent-code" name="token" type="text" placeholder="123456" required className="h-11 text-center text-lg tracking-widest" disabled={p.verifyPending} maxLength={6} />
          </div>
          <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={p.verifyPending}>
            {p.verifyPending ? "Vérification…" : "Valider le code"} {!p.verifyPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
          <button type="button" onClick={() => p.setStep("send")} className="w-full text-xs text-muted-foreground hover:text-foreground">← Changer d&apos;email</button>
        </form>
      )}
    </div>
  )
}
