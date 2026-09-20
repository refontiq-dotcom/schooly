import { ArrowRight, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type State = { error: string | null; success?: boolean }

export function SchoolLoginForm({ state, action, pending }: { state: State; action: (fd: FormData) => void; pending: boolean }) {
  return (
    <form action={action} className="gemini-glass rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Connexion établissement</h2>
        <p className="text-base leading-relaxed text-muted-foreground">Accédez à votre tableau de bord de gestion.</p>
      </div>
      {state.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-base">{state.error}</div>}
      <div className="space-y-2">
        <Label htmlFor="school-email">Email professionnel</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="school-email" name="email" type="email" placeholder="direction@mon-ecole.ci" required className="pl-10 h-11" disabled={pending} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="school-password">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="school-password" name="password" type="password" placeholder="••••••••" required className="pl-10 h-11" disabled={pending} />
        </div>
      </div>
      <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"} {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
      <div className="text-center pt-2">
        <span className="text-sm text-muted-foreground">Nouveau sur Schooly ? </span>
        <a href="/register-school" className="text-sm text-primary hover:underline font-medium">Créer votre établissement →</a>
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
        <h2 className="text-xl font-semibold text-foreground">{p.step === "send" ? "Espace Parent" : "Vérification"}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{p.step === "send" ? "Connectez-vous avec votre email. Aucun mot de passe nécessaire." : "Entrez le code reçu par email."}</p>
      </div>
      {p.step === "send" && (
        <form action={(fd) => { p.setContact(fd.get("email") as string); if (!p.sendState.error) p.setStep("verify"); p.sendAction(fd); }} className="space-y-4">
          {p.sendState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-base">{p.sendState.error}</div>}
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
          {p.verifyState.error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-base">{p.verifyState.error}</div>}
          <input type="hidden" name="email" value={p.contact} />
          <div className="space-y-2">
            <Label htmlFor="parent-code">Code de vérification</Label>
            <Input id="parent-code" name="token" type="text" placeholder="123456" required className="h-11 text-center text-lg tracking-widest" disabled={p.verifyPending} maxLength={6} />
          </div>
          <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={p.verifyPending}>
            {p.verifyPending ? "Vérification…" : "Valider le code"} {!p.verifyPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
          <button type="button" onClick={() => p.setStep("send")} className="w-full text-sm text-muted-foreground hover:text-foreground">← Changer d&apos;email</button>
        </form>
      )}
    </div>
  )
}

