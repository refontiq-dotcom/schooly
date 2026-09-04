"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setHomeroomTeacher } from "@/lib/classes-intelligence/actions";

type TeacherOption = { id: string; full_name: string };

export default function HomeroomForm({
  sectionId,
  teachers,
  currentTeacherId,
}: {
  sectionId: string;
  teachers: TeacherOption[];
  currentTeacherId: string | null;
}) {
  const router = useRouter();
  const [error, action, pending] = useActionState(setHomeroomTeacher, null);
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
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-slate-500" htmlFor={`homeroom-${sectionId}`}>Professeur principal</label>
        <select
          id={`homeroom-${sectionId}`}
          name="teacher_id"
          className="input"
          defaultValue={currentTeacherId ?? ""}
        >
          <option value="">Aucun titulaire</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-secondary whitespace-nowrap min-h-11">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
