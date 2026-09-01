import { notFound } from "next/navigation";
import StudentRow from "./student-row";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function ClassePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await getSessionProfile();

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

      <div className="card bg-slate-50 text-sm text-slate-500">
        📲 Un récapitulatif hebdomadaire (présence + notes) est envoyé automatiquement par
        WhatsApp à chaque parent en fin de semaine (workflow n8n — voir README, Phase 2).
      </div>
    </div>
  );
}
