"use client";

import { useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, signInWithGoogle } from "@/lib/auth/actions";

type Tab = "login" | "register";

export default function AuthForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "";
  const oauthError = searchParams.get("error");

  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, loginAction, loginPending] = useActionState(signIn, null);
  const [registerError, registerAction, registerPending] =
    useActionState(signUp, null);

  const isLogin = tab === "login";
  const action = isLogin ? loginAction : registerAction;
  const error = isLogin ? loginError : registerError;
  const pending = isLogin ? loginPending : registerPending;

  return (
    <div className="min-h-[85vh] flex items-center justify-center relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
        <svg width="200" height="300" viewBox="0 0 200 300" fill="none" className="opacity-20">
          <rect x="20" y="40" width="80" height="100" rx="8" stroke="#C4956A" strokeWidth="1.5" fill="none" />
          <rect x="30" y="60" width="60" height="8" rx="2" fill="#C4956A" opacity="0.3" />
          <rect x="30" y="80" width="40" height="8" rx="2" fill="#C4956A" opacity="0.3" />
          <rect x="30" y="100" width="50" height="8" rx="2" fill="#C4956A" opacity="0.3" />
          <rect x="100" y="180" width="70" height="90" rx="6" stroke="#C4956A" strokeWidth="1.5" fill="none" />
          <rect x="110" y="200" width="50" height="6" rx="2" fill="#C4956A" opacity="0.3" />
          <rect x="110" y="215" width="35" height="6" rx="2" fill="#C4956A" opacity="0.3" />
          <circle cx="135" cy="50" r="3" fill="#E8A44A" opacity="0.4" />
          <path d="M60 280 Q80 260 100 280" stroke="#C4956A" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
        <svg width="220" height="320" viewBox="0 0 220 320" fill="none" className="opacity-20">
          <circle cx="160" cy="60" r="22" stroke="#3D3D3D" strokeWidth="1.5" fill="none" />
          <path d="M160 82 L160 160" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 100 L130 140" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 100 L190 130" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 160 L140 220" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 160 L185 220" stroke="#3D3D3D" strokeWidth="1.5" />
          <rect x="170" y="125" width="35" height="25" rx="3" stroke="#3D3D3D" strokeWidth="1.5" fill="none" />
          <rect x="165" y="150" width="45" height="4" rx="1" fill="#C4956A" opacity="0.3" />
          <rect x="30" y="220" width="60" height="80" rx="6" fill="#E8A44A" opacity="0.15" />
          <circle cx="80" cy="100" r="4" fill="#E8A44A" opacity="0.3" />
        </svg>
      </div>

      <div className="w-full max-w-md mx-auto relative z-10">
        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isLogin ? "Connexion" : "Inscription"}
            </h1>
            <p className="text-sm text-slate-500">
              {isLogin
                ? "Connectez-vous pour accéder à votre espace"
                : "Créez un compte parent pour suivre votre enfant"}
            </p>
          </div>

          {!isLogin && (
            <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              L&apos;inscription publique crée un compte <strong>parent</strong>.
              Pour un établissement, créez-le après connexion. Le personnel
              (professeur, secrétariat) rejoint l&apos;espace via une invitation.
            </div>
          )}

          <form action={action} className="space-y-4">
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

            {!isLogin && (
              <>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Nom complet"
                  className="input"
                  autoComplete="name"
                />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Téléphone (optionnel)"
                  className="input"
                  autoComplete="tel"
                />
              </>
            )}

            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="Email"
                className="input pr-10"
                autoComplete="email"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </span>
            </div>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Mot de passe"
                className="input pr-16"
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>

            {(error || oauthError) && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
                {error || oauthError}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: "#E8A44A" }}
            >
              {pending
                ? "Chargement…"
                : isLogin
                  ? "Se connecter"
                  : "Créer mon compte parent"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 whitespace-nowrap">Ou continuer avec</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continuer avec Google
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              onClick={() => setTab(isLogin ? "register" : "login")}
              className="text-amber-600 font-semibold hover:underline"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
