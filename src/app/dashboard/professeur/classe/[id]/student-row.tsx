"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StudentRow({
  studentId,
  sectionId,
  studentName,
  initialPresent,
  average,
  prediction,
  atRisk,
}: {
  studentId: string;
  sectionId: string;
  studentName: string;
  initialPresent: boolean;
  average: string;
  prediction?: string;
  atRisk?: boolean;
}) {
  const router = useRouter();
  const [present, setPresent] = useState(initialPresent);
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);

  async function togglePresence() {
    const supabase = createClient();
    const next = !present;
    setPresent(next);

    const today = new Date().toISOString().slice(0, 10);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("attendance_records").upsert(
      {
        student_id: studentId,
        section_id: sectionId,
        session_date: today,
        present: next,
        recorded_by: user?.id ?? null,
      },
      { onConflict: "student_id,session_date" }
    );
    router.refresh();
  }

  async function addGrade() {
    const value = parseFloat(score);
    if (isNaN(value)) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("grades").insert({
      student_id: studentId,
      section_id: sectionId,
      recorded_by: user?.id ?? null,
      subject: "Général",
      evaluation_type: "interrogation",
      score: value,
      max_score: 20,
    });
    setScore("");
    setSaving(false);
    router.refresh();
  }

  return (
    <tr className={`border-b border-slate-100 last:border-0 ${atRisk ? "bg-red-50" : ""}`}>
      <td className="py-2 font-medium flex items-center gap-2">
        {studentName}
        {atRisk && <span className="badge-danger text-[10px]">⚠️</span>}
      </td>
      <td className="py-2">
        <button
          onClick={togglePresence}
          className={present ? "badge-success" : "badge-danger"}
        >
          {present ? "Présent" : "Absent"}
        </button>
      </td>
      <td className="py-2 text-slate-600 tabular-nums">{average}</td>
      <td className="py-2 text-slate-500 tabular-nums text-xs">{prediction ?? "—"}</td>
      <td className="py-2">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            placeholder="/20"
            className="input w-20"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <button onClick={addGrade} disabled={saving} className="btn-secondary text-xs px-3">
            Ajouter
          </button>
        </div>
      </td>
    </tr>
  );
}