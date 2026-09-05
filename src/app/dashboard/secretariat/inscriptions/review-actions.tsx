"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EnrollmentReviewActions({ id, canApprove }: { id: string; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/enrollment/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        window.alert(payload.error ?? "Action impossible");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 justify-end">
      <button disabled={busy} onClick={() => act("under_review")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
        Étudier
      </button>
      <button disabled={busy} onClick={() => act("incomplete")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
        Incomplet
      </button>
      {canApprove && (
        <button disabled={busy} onClick={() => act("approve")} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
          Valider l'inscription
        </button>
      )}
      <button disabled={busy} onClick={() => act("rejected")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        Refuser
      </button>
    </div>
  );
}
