"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAddGrades } from "@/lib/teacher-intelligence/actions";

interface Student {
  id: string;
  full_name: string;
}

export default function BulkGradeForm({
  sectionId,
  students,
}: {
  sectionId: string;
  students: Student[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("Mathématiques");
  const [evaluationType, setEvaluationType] = useState("devoir");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const entries = Object.entries(scores)
      .filter(([, v]) => v.trim().length > 0)
      .map(([studentId, v]) => ({ studentId, score: parseFloat(v) }))
      .filter((e) => Number.isFinite(e.score));

    if (entries.length === 0) {
      setError("Saisissez au moins une note.");
      return;
    }

    startTransition(async () => {
      const err = await bulkAddGrades(sectionId, subject, evaluationType, entries, date);
      if (err) {
        setError(err);
        return;
      }
      setScores({});
      router.refresh();
    });
  }

  const filledCount = Object.values(scores).filter((v) => v.trim().length > 0).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-slate-500">Matière</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="input"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Type</label>
          <select
            value={evaluationType}
            onChange={(e) => setEvaluationType(e.target.value)}
            className="input"
          >
            <option value="interrogation">Interrogation</option>
            <option value="devoir">Devoir</option>
            <option value="composition">Composition</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="input"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Élève</th>
              <th className="py-2 w-32">Note / 20</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{s.full_name}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={scores[s.id] ?? ""}
                    onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                    placeholder="—"
                    className="input w-24"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filledCount} note{filledCount > 1 ? "s" : ""} prête{filledCount > 1 ? "s" : ""} à enregistrer
        </p>
        <button type="submit" disabled={pending || filledCount === 0} className="btn-primary min-h-11">
          {pending ? "Enregistrement…" : `Enregistrer ${filledCount} note(s)`}
        </button>
      </div>
    </form>
  );
}