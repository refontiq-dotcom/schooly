"use client";

import { useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, signInWithGoogle, signInParent } from "@/lib/auth/actions";

type View = "role-select" | "parent-login" | "establishment-login" | "establishment-register";

export default function AuthForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "";
  const oauthError = searchParams.get("error");

  const [view, setView] = useState<View>("role-select");
  const [showPassword, setShowPassword] = useState(false);

  const [loginError, loginAction, loginPending] = useActionState(signIn, null);
  const [registerError, registerAction, registerPending] = useActionState(signUp, null);
  const [parentError, parentAction, parentPending] = useActionState(signInParent, null);

  const isLogin = view === "establishment-login";
  const action = isLogin ? loginAction : registerAction;
  const error = isLogin ? loginError : registerError;
  const pending = isLogin ? loginPending : registerPending;

  // Success message for parent magic link
  const parentSuccess = parentError?.startsWith("__SUCCESS__")
    ? parentError.replace("__SUCCESS__", "")
    : null;
  const parentErrorMessage = parentSuccess ? null : parentError;

  // ── Role selector ──
  if (view === "role-select") {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-full max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-slate-800 mb-3">
              Bienvenue sur Schooly
            </h1>
            <p className="text-sm text-slate-500">
              Comment souhaitez-vous vous connecter ?
            </p>
          </div>

          <div className="space-y-4">
            {/* Parent card */}
            <button
              type="button"
              onClick={() => setView("parent-login")}
              className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-5 hover:shadow-md hover:border-amber-200 transition-all text-left group"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  Je suis parent
                </h3>
                <p className="text-sm text-slate-400">
                  Accédez au suivi scolaire de votre enfant
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Establishment card */}
            <button
              type="button"
              onClick={() => setView("establishment-login")}
              className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-5 hover:shadow-md hover:border-slate-300 transition-all text-left group"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-slate-100 transition-colors">
                <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  Établissement scolaire
                </h3>
                <p className="text-sm text-slate-400">
                  Gérez votre école, vos élèves et vos services
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            <button
              onClick={() => setView("establishment-register")}
              className="text-amber-600 hover:underline"
            >
              Créer un compte établissement
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Parent phone login ──
  if (view === "parent-login") {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setView("role-select")}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Retour
          </button>

          <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Connexion parent
              </h1>
              <p className="text-sm text-slate-500">
                Saisissez le numéro de téléphone utilisé lors de l&apos;inscription de votre enfant
              </p>
            </div>

            {parentSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-5 text-center">
                <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="text-sm text-green-700 font-medium">{parentSuccess}</p>
                <p className="text-xs text-green-600 mt-2">
                  Le lien est valable pendant 10 minutes.
                </p>
              </div>
            ) : (
              <form action={parentAction} className="space-y-4">
                {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                      </svg>
                    </span>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="+225 07 00 00 00 01"
                      className="input pl-11"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                {parentErrorMessage && (
                  <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
                    {parentErrorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={parentPending}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ backgroundColor: "#E8A44A" }}
                >
                  {parentPending ? "Vérification…" : "Recevoir le lien de connexion"}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-slate-400 mt-6">
              <button
                onClick={() => setView("role-select")}
                className="text-amber-600 font-semibold hover:underline"
              >
                Se connecter en tant qu&apos;établissement
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Establishment login / register ──
  const establishmentView = view as "establishment-login" | "establishment-register";
  const establishmentAction = establishmentView === "establishment-login" ? loginAction : registerAction;
  const establishmentError = establishmentView === "establishment-login" ? loginError : registerError;
  const establishmentPending = establishmentView === "establishment-login" ? loginPending : registerPending;
  const isEstablishmentLogin = establishmentView === "establishment-login";

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
        <button
          type="button"
          onClick={() => setView("role-select")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Changer de compte
        </button>

        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isEstablishmentLogin ? "Connexion" : "Inscription établissement"}
            </h1>
            <p className="text-sm text-slate-500">
              {isEstablishmentLogin
                ? "Connectez-vous pour gérer votre établissement"
                : "Créez un compte administrateur pour votre école"}
            </p>
          </div>

          {!isEstablishmentLogin && (
            <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Le compte créé est un compte <strong>administrateur</strong>.
              Le personnel (professeur, secrétariat) rejoint l&apos;espace via une invitation.
            </div>
          )}

          <form action={establishmentAction} className="space-y-4">
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

            {!isEstablishmentLogin && (
              <>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Nom complet"
                  className="input"
                  autoComplete="name"
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
                autoComplete={isEstablishmentLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>

            {(establishmentError || oauthError) && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
                {establishmentError || oauthError}
              </div>
            )}

            <button
              type="submit"
              disabled={establishmentPending}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: "#E8A44A" }}
            >
              {establishmentPending
                ? "Chargement…"
                : isEstablishmentLogin
                  ? "Se connecter"
                  : "Créer mon compte"}
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
            {isEstablishmentLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              onClick={() => setView(isEstablishmentLogin ? "establishment-register" : "establishment-login")}
              className="text-amber-600 font-semibold hover:underline"
            >
              {isEstablishmentLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
