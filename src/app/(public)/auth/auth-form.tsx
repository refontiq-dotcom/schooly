"use client";

import { useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, signInWithGoogle, signInParent } from "@/lib/auth/actions";

type View = "role-select" | "parent-login" | "establishment-login" | "establishment-register";

export default function AuthForm() {
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "";
  const oauthError = params.get("error");
  const [view, setView] = useState<View>("role-select");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, loginAction, loginPending] = useActionState(signIn, null);
  const [registerError, registerAction, registerPending] = useActionState(signUp, null);
  const [parentError, parentAction, parentPending] = useActionState(signInParent, null);

  if (view === "role-select") return (
    <main className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-800">Bienvenue sur Schooly</h1>
          <p className="mt-3 text-sm text-slate-500">Comment souhaitez-vous vous connecter ?</p>
        </div>
        <div className="space-y-4">
          <button type="button" onClick={() => setView("parent-login")} className="w-full rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md">
            <div className="text-lg font-semibold text-slate-800">Je suis parent</div>
            <div className="mt-1 text-sm text-slate-400">Connexion sécurisée par SMS avec le numéro utilisé pour l'inscription de votre enfant.</div>
          </button>
          <button type="button" onClick={() => setView("establishment-login")} className="w-full rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div className="text-lg font-semibold text-slate-800">Établissement scolaire</div>
            <div className="mt-1 text-sm text-slate-400">Gérez votre école, vos élèves et vos services.</div>
          </button>
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">
          <button type="button" onClick={() => setView("establishment-register")} className="font-medium text-amber-600 hover:underline">Créer un compte établissement</button>
        </p>
      </div>
    </main>
  );

  if (view === "parent-login") return (
    <main className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg md:p-10">
        <button type="button" onClick={() => setView("role-select")} className="mb-6 text-sm text-slate-400 hover:text-slate-600">← Retour</button>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">📱</div>
          <h1 className="text-2xl font-bold text-slate-800">Connexion parent</h1>
          <p className="mt-2 text-sm text-slate-500">Utilisez le numéro de téléphone enregistré lors de l'inscription de votre enfant.</p>
        </div>
        <form action={parentAction} className="space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <label className="block text-sm font-medium text-slate-700">Numéro de téléphone
            <input name="phone" type="tel" required placeholder="+225 07 00 00 00 00" className="input mt-1" autoComplete="tel" />
          </label>
          {parentError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{parentError}</div>}
          <button type="submit" disabled={parentPending} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#E8A44A" }}>
            {parentPending ? "Envoi du code…" : "Recevoir mon code SMS"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">Le numéro doit déjà être enregistré dans le dossier d'un élève.</p>
      </div>
    </main>
  );

  const establishmentLogin = view === "establishment-login";
  const action = establishmentLogin ? loginAction : registerAction;
  const error = establishmentLogin ? loginError : registerError;
  const pending = establishmentLogin ? loginPending : registerPending;

  return (
    <main className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg md:p-10">
        <button type="button" onClick={() => setView("role-select")} className="mb-6 text-sm text-slate-400 hover:text-slate-600">← Changer de compte</button>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">{establishmentLogin ? "Connexion" : "Inscription établissement"}</h1>
          <p className="mt-2 text-sm text-slate-500">{establishmentLogin ? "Connectez-vous à votre espace établissement." : "Créez votre compte administrateur."}</p>
        </div>
        <form action={action} className="space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          {!establishmentLogin && <input name="full_name" placeholder="Nom complet" className="input" autoComplete="name" />}
          <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
          <div className="relative">
            <input name="password" type={showPassword ? "text" : "password"} required minLength={6} placeholder="Mot de passe" className="input pr-20" autoComplete={establishmentLogin ? "current-password" : "new-password"} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{showPassword ? "Masquer" : "Afficher"}</button>
          </div>
          {(error || oauthError) && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error || oauthError}</div>}
          <button type="submit" disabled={pending} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#E8A44A" }}>
            {pending ? "Chargement…" : establishmentLogin ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-400">Ou</span><div className="h-px flex-1 bg-slate-200" /></div>
        <form action={signInWithGoogle}><button type="submit" className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Continuer avec Google</button></form>
        <p className="mt-6 text-center text-sm text-slate-400">
          {establishmentLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button type="button" onClick={() => setView(establishmentLogin ? "establishment-register" : "establishment-login")} className="font-semibold text-amber-600 hover:underline">{establishmentLogin ? "S'inscrire" : "Se connecter"}</button>
        </p>
      </div>
    </main>
  );
}
