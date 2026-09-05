"use client";

import { useActionState } from "react";
import { signInParent } from "@/lib/auth/actions";

export function ParentOtpForm({ phone, returnTo }: { phone: string; returnTo: string }) {
  const [error, action, pending] = useActionState(signInParent, null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label htmlFor="otp" className="mb-2 block text-sm font-medium text-slate-700">Code OTP</label>
        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          minLength={6}
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="000000"
          className="input text-center text-2xl font-semibold tracking-[0.5em]"
        />
      </div>
      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#E8A44A" }}
      >
        {pending ? "Vérification…" : "Valider le code"}
      </button>
      <p className="text-center text-xs text-slate-400">Le code SMS est à usage unique.</p>
    </form>
  );
}
