"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignTeacher } from "@/lib/classes-intelligence/actions";

export default function UnassignButton({
  assignmentId,
  sectionId,
  label,
}: {
  assignmentId: string;
  sectionId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Retirer ${label}`}
        className="text-slate-400 hover:text-red-600 p-1 rounded-lg min-h-11 min-w-11 inline-flex items-center justify-center disabled:opacity-50"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const err = await unassignTeacher(assignmentId, sectionId);
            if (err) {
              setError(err);
              return;
            }
            router.refresh();
          });
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </span>
  );
}
