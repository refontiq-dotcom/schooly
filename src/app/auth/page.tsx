"use client";

import { useState, useActionState } from "react";
import { signIn, signUp, signInWithGoogle } from "@/lib/auth/actions";
import type { UserRole } from "@/lib/auth/actions";

type Tab = "login" | "register";

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>("login");
  const [role, setRole] = useState<UserRole>("parent");
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
      {/* Decorative elements - left side */}
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

      {/* Decorative elements - right side */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
        <svg width="220" height="320" viewBox="0 0 220 320" fill="none" className="opacity-20">
          {/* Person sitting illustration - simplified */}
          <circle cx="160" cy="60" r="22" stroke="#3D3D3D" strokeWidth="1.5" fill="none" />
          <path d="M160 82 L160 160" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 100 L130 140" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 100 L190 130" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 160 L140 220" stroke="#3D3D3D" strokeWidth="1.5" />
          <path d="M160 160 L185 220" stroke="#3D3D3D" strokeWidth="1.5" />
          {/* Laptop */}
          <rect x="170" y="125" width="35" height="25" rx="3" stroke="#3D3D3D" strokeWidth="1.5" fill="none" />
          <rect x="165" y="150" width="45" height="4" rx="1" fill="#C4956A" opacity="0.3" />
          {/* Decorative shapes */}
          <rect x="30" y="220" width="60" height="80" rx="6" fill="#E8A44A" opacity="0.15" />
          <rect x="35" y="225" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <rect x="50" y="225" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <rect x="65" y="225" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <rect x="35" y="240" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <rect x="50" y="240" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <rect x="65" y="240" width="8" height="8" rx="1" fill="#3D3D3D" opacity="0.15" />
          <circle cx="80" cy="100" r="4" fill="#E8A44A" opacity="0.3" />
          <path d="M120 280 Q140 265 160 280" stroke="#C4956A" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md mx-auto relative z-10">
        <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {isLogin ? "Connexion" : "Inscription"}
            </h1>
            <p className="text-sm text-slate-500">
              {isLogin
                ? "Connectez-vous pour accéder à votre espace"
                : "Créez votre compte pour commencer"}
            </p>
          </div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Je suis
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("parent")}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  role === "parent"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                👨‍👩‍👧 Parent
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  role === "admin"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                🏫 Administrateur
              </button>
            </div>
          </div>

          {/* Email Form */}
          <form action={action} className="space-y-4">
            <input type="hidden" name="role" value={role} />

            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="Email / Téléphone"
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

            {isLogin && (
              <div className="text-right">
                <a href="#" className="text-xs text-slate-400 hover:text-amber-600 transition-colors">
                  Mot de passe oublié ?
                </a>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: "#E8A44A" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D69538")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E8A44A")}
            >
              {pending
                ? "Chargement…"
                : isLogin
                  ? "Se connecter"
                  : "Créer mon compte"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 whitespace-nowrap">Ou continuer avec</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Social Login Buttons */}
          <form action={() => signInWithGoogle(role)}>
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

          {/* Switch tab */}
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
