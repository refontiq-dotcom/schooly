"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateSectionCapacity } from "@/lib/classes-intelligence/actions";

export default function CapacityForm({
  sectionId,
  capacity,
}: {
  sectionId: string;
  capacity: number;
}) {
  const router = useRouter();
  const [error, action, pending] = useActionState(updateSectionCapacity, null);
  const lastPending = useRef(pending);

  useEffect(() => {
    if (lastPending.current && !pending && !error) {
      router.refresh();
    }
    lastPending.current = pending;
  }, [pending, error, router]);

  return (
    <form action={action} className="flex flex-wrap gap-2 items-end">
      <input type="hidden" name="section_id" value={sectionId} />
      <div>
        <label className="text-xs text-slate-500" htmlFor={`cap-${sectionId}`}>Capacité</label>
        <input
          id={`cap-${sectionId}`}
          name="capacity"
          type="number"
          min={1}
          defaultValue={capacity}
          className="input w-28"
          required
        />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary whitespace-nowrap min-h-11">
        {pending ? "Enregistrement…" : "Mettre à jour"}
      </button>
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
