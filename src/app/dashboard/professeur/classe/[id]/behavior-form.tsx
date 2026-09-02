"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addBehaviorNote } from "@/lib/operations/actions";

export default function BehaviorForm({
  studentId,
  sectionId,
  studentName,
}: {
  studentId: string;
  sectionId: string;
  studentName: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(addBehaviorNote, null);
  const last = useRef(pending);

  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="section_id" value={sectionId} />
      <select name="kind" className="input" defaultValue="a_surveiller" aria-label={`Type de suivi pour ${studentName}`}>
        <option value="positif">Point positif</option>
        <option value="a_surveiller">À surveiller</option>
        <option value="incident">Incident</option>
      </select>
      <input name="title" required className="input sm:col-span-2" placeholder={`Observation — ${studentName}`} />
      <input name="body" className="input sm:col-span-2" placeholder="Détail (optionnel)" />
      <button type="submit" disabled={pending} className="btn-secondary min-h-11">
        {pending ? "…" : "Ajouter"}
      </button>
      {error && <p className="sm:col-span-3 text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
