"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { acceptInvitation } from "@/lib/auth/actions";

export default function InvitationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, action, pending] = useActionState(acceptInvitation, null);

  return (
    <div className="max-w-md mx-auto">
      <div className="card space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-navy">Invitation personnel</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acceptez l&apos;invitation pour rejoindre l&apos;établissement avec le rôle
            attribué par l&apos;administrateur. Utilisez le même email que celui
            invité.
          </p>
        </div>

        {!token ? (
          <p className="text-sm text-red-600">Jeton d&apos;invitation manquant.</p>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
                {error}
              </div>
            )}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Validation…" : "Accepter l'invitation"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
