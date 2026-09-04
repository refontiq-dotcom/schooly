"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addLevel } from "@/lib/classes-intelligence/actions";

export default function AddLevelForm({ establishmentId }: { establishmentId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(addLevel, null);
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
      <input type="hidden" name="establishment_id" value={establishmentId} />
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs text-slate-500" htmlFor="level-name">Nom du niveau</label>
        <input
          id="level-name"
          name="name"
          className="input"
          placeholder="Ex: 6ème"
          required
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary whitespace-nowrap min-h-11">
        {pending ? "Ajout…" : "Ajouter le niveau"}
      </button>
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
