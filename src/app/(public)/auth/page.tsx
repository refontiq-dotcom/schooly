"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-navy/10 p-8 shadow-sm">
        <h1 className="text-2xl font-bold">
          Connexion parent
        </h1>
        <p className="mt-2 text-sm text-muted">
          La connexion se fait avec le numéro de téléphone de l&apos;enfant
          inscrit dans un établissement.
        </p>

        {sent ? (
          <p className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            Un code de connexion a été envoyé par SMS au {phone}.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">
                Numéro de téléphone
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+225 07 00 00 00 00"
                className="mt-1 w-full rounded-lg border border-navy/20 px-4 py-2.5 outline-none transition-colors focus:border-brand"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Recevoir le code"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
