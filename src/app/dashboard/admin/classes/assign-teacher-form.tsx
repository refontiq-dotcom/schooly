"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignTeacher } from "@/lib/classes-intelligence/actions";
import { COMMON_SUBJECTS } from "@/lib/classes-intelligence/scoring";

type TeacherOption = { id: string; full_name: string };

export default function AssignTeacherForm({
  sectionId,
  teachers,
}: {
  sectionId: string;
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(assignTeacher, null);
  const lastPending = useRef(pending);

  useEffect(() => {
    if (lastPending.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    lastPending.current = pending;
  }, [pending, error, router]);

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun professeur dans l&apos;équipe.{" "}
        <Link href="/dashboard/admin/equipe" className="text-amber-700 font-medium hover:underline">
          Inviter un professeur
        </Link>
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-wrap gap-2 items-end">
      <input type="hidden" name="section_id" value={sectionId} />
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs text-slate-500" htmlFor={`teacher-${sectionId}`}>Professeur</label>
        <select id={`teacher-${sectionId}`} name="teacher_id" className="input" required defaultValue="">
          <option value="" disabled>Choisir…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs text-slate-500" htmlFor={`subject-${sectionId}`}>Matière</label>
        <input
          id={`subject-${sectionId}`}
          name="subject"
          className="input"
          list={`subjects-${sectionId}`}
          placeholder="Ex: Mathématiques"
          required
        />
        <datalist id={`subjects-${sectionId}`}>
          {COMMON_SUBJECTS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <button type="submit" disabled={pending} className="btn-primary whitespace-nowrap min-h-11">
        {pending ? "Affectation…" : "Affecter"}
      </button>
      {error && <p className="w-full text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
