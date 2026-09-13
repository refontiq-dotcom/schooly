import { ArrowRight, Mail, Lock, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type State = { error: string | null; success?: boolean }

export function SchoolLoginForm({ state, action, pending }: { state: State; action: (fd: FormData) => void; pending: boolean }) {
  return (
    <form action={action} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Connexion établissement</h2>
        <p className="text-xs text-slate-500">Accédez à votre tableau de bord de gestion.</p>
      </div>
      {state.error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}
      <div className="space-y-2">
        <Label htmlFor="school-email">Email professionnel</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input id="school-email" name="email" type="email" placeholder="direction@mon-ecole.ci" required className="pl-10 h-11" disabled={pending} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="school-password">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input id="school-password" name="password" type="password" placeholder="••••••••" required className="pl-10 h-11" disabled={pending} />
        </div>
      </div>
      <Button type="submit" className="w-full h-11 text-base font-semibold bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"} {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
      <div className="text-center pt-2">
        <span className="text-xs text-slate-500">Nouveau sur Schooly ? </span>
        <a href="/register-school" className="text-xs text-[#1E3A8A] hover:underline font-medium">Créer votre établissement →</a>
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{p.step === "send" ? "Espace Parent" : "Vérification"}</h2>
        <p className="text-xs text-slate-500">{p.step === "send" ? "Connectez-vous avec email ou téléphone. Aucun mot de passe nécessaire." : "Entrez le code reçu par email ou SMS."}</p>
      </div>
      {p.step === "send" && (
        <form action={(fd) => { p.setContact(fd.get("contact") as string); if (!p.sendState.error) p.setStep("verify"); p.sendAction(fd); }} className="space-y-4">
          {p.sendState.error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{p.sendState.error}</div>}
          <div className="space-y-2">
            <Label htmlFor="parent-contact">Email ou téléphone</Label>
            <div className="relative">
              {(!p.contact || p.contact.includes("@")) ? <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /> : <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />}
              <Input id="parent-contact" name="contact" type="text" placeholder="parent@email.com ou 07 00 00 00 00" required className="pl-10 h-11" disabled={p.sendPending} defaultValue={p.contact} />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 text-base font-semibold bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" disabled={p.sendPending}>
            {p.sendPending ? "Envoi…" : "Recevoir le code"} {!p.sendPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      )}
      {p.step === "verify" && (
        <form action={p.verifyAction} className="space-y-4">
          {p.verifyState.error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{p.verifyState.error}</div>}
          <input type="hidden" name="contact" value={p.contact} />
          <div className="space-y-2">
            <Label htmlFor="parent-code">Code de vérification</Label>
            <Input id="parent-code" name="token" type="text" placeholder="123456" required className="h-11 text-center text-lg tracking-widest" disabled={p.verifyPending} maxLength={6} />
          </div>
          <Button type="submit" className="w-full h-11 text-base font-semibold bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" disabled={p.verifyPending}>
            {p.verifyPending ? "Vérification…" : "Valider le code"} {!p.verifyPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
          <button type="button" onClick={() => p.setStep("send")} className="w-full text-xs text-slate-500 hover:text-slate-700">← Changer d&apos;email ou téléphone</button>
        </form>
      )}
    </div>
  )
}
