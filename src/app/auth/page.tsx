"use client";

import { useState, useActionState } from "react";
import { signIn, signUp, signInWithGoogle } from "@/lib/auth/actions";
import type { UserRole } from "@/lib/auth/actions";

type Tab = "login" | "register";

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>("register");
  const [role, setRole] = useState<UserRole>("parent");
  const [loginError, loginAction, loginPending] = useActionState(signIn, null);
  const [registerError, registerAction, registerPending] =
    useActionState(signUp, null);

  const isLogin = tab === "login";
  const action = isLogin ? loginAction : registerAction;
  const error = isLogin ? loginError : registerError;
  const pending = isLogin ? loginPending : registerPending;

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy mb-2">
            Trouve<span className="text-brand">tou</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Plateforme de gestion scolaire
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Tabs */}
          <div className="flex mb-6 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                isLogin
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setTab("register")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                !isLogin
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Role Selector */}
          <div className="mb-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Je suis
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("parent")}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  role === "parent"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className="block text-lg mb-0.5">👨‍👩‍👧</span>
                Parent
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  role === "admin"
                    ? "border-navy bg-navy/5 text-navy"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className="block text-lg mb-0.5">🏫</span>
                Administrateur
              </button>
            </div>
          </div>

          {/* Google Sign-In */}
          <form action={() => signInWithGoogle(role)}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuer avec Google
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Email Form */}
          <form action={action} className="space-y-3">
            <input type="hidden" name="role" value={role} />

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="vous@exemple.com"
                className="input"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="input"
                minLength={6}
                autoComplete={
                  isLogin ? "current-password" : "new-password"
                }
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className={`w-full py-2.5 rounded-lg text-white font-medium transition-colors ${
                role === "admin"
                  ? "bg-navy hover:bg-navy/90"
                  : "bg-brand hover:bg-brand/90"
              } disabled:opacity-50`}
            >
              {pending
                ? "Chargement…"
                : isLogin
                  ? "Se connecter"
                  : "Créer mon compte"}
            </button>
          </form>

          {/* Switch tab hint */}
          <p className="text-center text-sm text-slate-500 mt-4">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              onClick={() => setTab(isLogin ? "register" : "login")}
              className="text-brand font-medium hover:underline"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
