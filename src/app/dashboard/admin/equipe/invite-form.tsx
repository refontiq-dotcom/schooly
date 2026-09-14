"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { inviteStaff } from "@/lib/auth/actions";

export default function InviteStaffForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(inviteStaff, null);
  const lastPending = useRef(pending);

  useEffect(() => {
    if (lastPending.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    lastPending.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-slate-500">Email du collaborateur</label>
        <input
          name="email"
          type="email"
          required
          className="input"
          placeholder="prenom@etablissement.ci"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Rôle</label>
        <select name="role" className="input w-48" defaultValue="professeur" required>
          <option value="professeur">Professeur</option>
          <option value="secretariat">Secrétariat</option>
          <option value="censeur">Censeur</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-primary whitespace-nowrap">
        {pending ? "Envoi…" : "Inviter"}
      </button>
      {error && (
        <p className="w-full text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
