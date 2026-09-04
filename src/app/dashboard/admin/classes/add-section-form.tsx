"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addSection } from "@/lib/classes-intelligence/actions";
import { DEFAULT_SECTION_CAPACITY } from "@/lib/classes-intelligence/scoring";

export default function AddSectionForm({ levelId }: { levelId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(addSection, null);
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
      <input type="hidden" name="level_id" value={levelId} />
      <div>
        <label className="text-xs text-slate-500" htmlFor={`section-name-${levelId}`}>Nom de la section</label>
        <input
          id={`section-name-${levelId}`}
          name="name"
          className="input"
          placeholder="Ex: 6ème1"
          required
        />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor={`section-cap-${levelId}`}>Capacité</label>
        <input
          id={`section-cap-${levelId}`}
          name="capacity"
          type="number"
          min={1}
          defaultValue={DEFAULT_SECTION_CAPACITY}
          className="input w-28"
          required
        />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary whitespace-nowrap min-h-11">
        {pending ? "Ajout…" : "Ajouter la section"}
      </button>
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
