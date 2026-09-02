import { notFound, redirect } from "next/navigation";
import StudentRow from "./student-row";
import BehaviorForm from "./behavior-form";
import { getSessionProfile } from "@/lib/auth/session";
import { BEHAVIOR_KIND_LABEL } from "@/lib/operations/labels";
import type { BehaviorKind } from "@/types";

export const revalidate = 0;

export default async function ClassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect(`/auth?returnTo=/dashboard/professeur/classe/${id}`);
  }

  if (profile?.role === "professeur") {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("teacher_id", profile.id)
      .eq("section_id", id)
      .maybeSingle();
    if (!assignment) return notFound();
  }

  const { data: section } = await supabase
    .from("sections")
    .select("*, levels(name)")
    .eq("id", id)
    .single();

  if (!section) return notFound();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("section_id", id)
    .order("full_name");

  const today = new Date().toISOString().slice(0, 10);

  const { data: todayAttendance } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("section_id", id)
    .eq("session_date", today);

  const { data: recentGrades } = await supabase
    .from("grades")
    .select("*")
    .eq("section_id", id)
    .order("evaluation_date", { ascending: false })
    .limit(100);

  const { data: behavior } = await supabase
    .from("behavior_notes")
    .select("*")
    .eq("section_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          {(section.levels as { name: string } | null)?.name}
        </p>
        <h1 className="text-2xl font-bold text-navy">{section.name}</h1>
        <p className="text-sm text-slate-500">
          {section.seats_taken} / {section.capacity} élèves inscrits
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-4">
          Présence & notes du jour — {new Date().toLocaleDateString("fr-FR")}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Présence</th>
              <th className="py-2">Ajouter une note</th>
              <th className="py-2">Moyenne</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((student) => {
              const attendance = todayAttendance?.find((a) => a.student_id === student.id);
              const grades = recentGrades?.filter((g) => g.student_id === student.id) ?? [];
              const average =
                grades.length > 0
                  ? (
                      grades.reduce((s, g) => s + (g.score / g.max_score) * 20, 0) / grades.length
                    ).toFixed(1)
                  : "—";

              return (
                <StudentRow
                  key={student.id}
                  studentId={student.id}
                  sectionId={id}
                  studentName={student.full_name}
                  initialPresent={attendance ? attendance.present : true}
                  average={average}
                />
              );
            })}
            {(!students || students.length === 0) && (
              <tr>
                <td colSpan={4} className="py-4 text-slate-400">
                  Aucun élève inscrit dans cette section pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-navy">Comportement & alertes précoces</h2>
        <p className="text-sm text-slate-500">
          Visible par les parents. Utilisez-le pour signaler un décrochage, une absence répétée ou un progrès.
        </p>
        {(students ?? []).slice(0, 8).map((student) => (
          <div key={student.id} className="border border-slate-100 rounded-xl p-3">
            <p className="text-sm font-medium text-navy mb-2">{student.full_name}</p>
            <BehaviorForm studentId={student.id} sectionId={id} studentName={student.full_name} />
          </div>
        ))}
        <ul className="text-sm space-y-2">
          {(behavior ?? []).map((n) => (
            <li key={n.id}>
              <span className="font-medium">{BEHAVIOR_KIND_LABEL[n.kind as BehaviorKind]}</span>
              {" — "}
              {n.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
