import { notFound, redirect } from "next/navigation";
import StudentRow from "./student-row";
import BehaviorForm from "./behavior-form";
import BulkGradeForm from "./bulk-grade-form";
import { getSessionProfile } from "@/lib/auth/session";
import { BEHAVIOR_KIND_LABEL } from "@/lib/operations/labels";
import {
  GRADE_BUCKET_COLOR,
  GRADE_BUCKET_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
  gradeBucket,
  normalizeScore,
} from "@/lib/teacher-intelligence/scoring";
import type { BehaviorKind } from "@/types";

export const revalidate = 0;

type ClassDashboard = {
  section_id: string;
  section_name: string;
  level_name: string;
  capacity: number;
  seats_taken: number;
  class_average: number;
  class_median: number;
  attendance_rate_pct: number | null;
  total_grades: number;
  recent_grades: number;
};

type StudentAtRisk = {
  student_id: string;
  full_name: string;
  section_id: string;
  section_name: string;
  current_average: number;
  latest_score: number;
  previous_score: number;
  has_significant_drop: boolean;
  has_repeated_absences: boolean;
  has_behavior_concerns: boolean;
  has_low_average: boolean;
  risk_level: "low" | "medium" | "high";
};

type Distribution = {
  section_id: string;
  bucket: "excellent" | "bien" | "moyen" | "fragile" | "critique";
  count: number;
};

type StudentPrediction = {
  student_id: string;
  full_name: string;
  current_average: number;
  predicted_average: number;
};

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

  const [{ data: section }, { data: dashboardRow }, { data: atRisk }, { data: distribution }, { data: predictions }] =
    await Promise.all([
      supabase.from("sections").select("*, levels(name)").eq("id", id).single(),
      supabase.from("class_dashboard").select("*").eq("section_id", id).maybeSingle<ClassDashboard>(),
      supabase.from("students_at_risk").select("*").eq("section_id", id),
      supabase.from("class_grade_distribution").select("*").eq("section_id", id),
      supabase.from("student_predictions").select("*").eq("section_id", id),
    ]);

  if (!section) return notFound();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("section_id", id)
    .order("full_name");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: todayAttendance }, { data: recentGrades }, { data: behavior }] =
    await Promise.all([
      supabase
        .from("attendance_records")
        .select("*")
        .eq("section_id", id)
        .eq("session_date", today),
      supabase
        .from("grades")
        .select("*")
        .eq("section_id", id)
        .order("evaluation_date", { ascending: false })
        .limit(100),
      supabase
        .from("behavior_notes")
        .select("*")
        .eq("section_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const dash = dashboardRow ?? {
    section_id: id,
    section_name: section.name,
    level_name: (section.levels as { name: string } | null)?.name ?? "",
    capacity: section.capacity,
    seats_taken: section.seats_taken,
    class_average: 0,
    class_median: 0,
    attendance_rate_pct: null,
    total_grades: 0,
    recent_grades: 0,
  };

  const distMap = new Map<string, number>();
  for (const d of distribution ?? []) {
    distMap.set(d.bucket, d.count);
  }

  const predictionMap = new Map<string, StudentPrediction>();
  for (const p of predictions ?? []) {
    predictionMap.set(p.student_id, p as StudentPrediction);
  }

  const atRiskIds = new Set((atRisk ?? []).map((r: StudentAtRisk) => r.student_id));

  const highRisk = (atRisk ?? []).filter((r: StudentAtRisk) => r.risk_level === "high");
  const mediumRisk = (atRisk ?? []).filter((r: StudentAtRisk) => r.risk_level === "medium");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{dash.level_name}</p>
        <h1 className="text-2xl font-bold text-navy">{dash.section_name}</h1>
        <p className="text-sm text-slate-500">
          {dash.seats_taken} / {dash.capacity} élèves inscrits
        </p>
      </div>

      {/* KPI agrégés de la classe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Moyenne de classe"
          value={`${Number(dash.class_average).toFixed(2)} / 20`}
          color={Number(dash.class_average) >= 12 ? "text-emerald-700" : Number(dash.class_average) >= 10 ? "text-amber-700" : "text-red-700"}
        />
        <Kpi
          label="Médiane"
          value={`${Number(dash.class_median).toFixed(2)} / 20`}
          color="text-navy"
        />
        <Kpi
          label="Taux de présence (30j)"
          value={dash.attendance_rate_pct !== null ? `${dash.attendance_rate_pct}%` : "—"}
          color={
            dash.attendance_rate_pct === null
              ? "text-slate-400"
              : dash.attendance_rate_pct >= 90
              ? "text-emerald-700"
              : dash.attendance_rate_pct >= 75
              ? "text-amber-700"
              : "text-red-700"
          }
        />
        <Kpi
          label="Notes récentes (7j)"
          value={String(dash.recent_grades)}
          color="text-navy"
        />
      </div>

      {/* Distribution des notes + alertes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Distribution des notes (90j)</h2>
          <div className="space-y-2">
            {(["excellent", "bien", "moyen", "fragile", "critique"] as const).map((bucket) => {
              const count = distMap.get(bucket) ?? 0;
              const max = Math.max(1, ...Array.from(distMap.values()));
              const pct = (count / max) * 100;
              return (
                <div key={bucket}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{GRADE_BUCKET_LABEL[bucket]}</span>
                    <span className="tabular-nums text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${GRADE_BUCKET_COLOR[bucket]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-3">
            🚨 Alertes précoces ({highRisk.length + mediumRisk.length})
          </h2>
          {highRisk.length + mediumRisk.length === 0 ? (
            <p className="text-sm text-emerald-700">
              Aucun élève en décrochage détecté. Continuez !
            </p>
          ) : (
            <div className="space-y-2">
              {highRisk.map((r: StudentAtRisk) => (
                <AlertRow key={r.student_id} row={r} />
              ))}
              {mediumRisk.map((r: StudentAtRisk) => (
                <AlertRow key={r.student_id} row={r} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saisie en lot */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Saisie en lot d&apos;évaluation</h2>
        <BulkGradeForm
          sectionId={id}
          students={(students ?? []).map((s) => ({ id: s.id, full_name: s.full_name }))}
        />
      </div>

      {/* Présence & notes du jour */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-4">
          Présence & notes du jour — {new Date().toLocaleDateString("fr-FR")}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Présence</th>
              <th className="py-2">Moyenne</th>
              <th className="py-2">Prédiction</th>
              <th className="py-2">Ajouter une note</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((student) => {
              const attendance = todayAttendance?.find((a) => a.student_id === student.id);
              const grades = recentGrades?.filter((g) => g.student_id === student.id) ?? [];
              const normalized = grades.map((g) => normalizeScore(g.score, g.max_score));
              const average =
                normalized.length > 0
                  ? (normalized.reduce((s, n) => s + n, 0) / normalized.length).toFixed(1)
                  : "—";

              const pred = predictionMap.get(student.id);
              const predictionText = pred
                ? `${Number(pred.predicted_average).toFixed(1)} / 20`
                : "—";
              const isAtRisk = atRiskIds.has(student.id);

              return (
                <StudentRow
                  key={student.id}
                  studentId={student.id}
                  sectionId={id}
                  studentName={student.full_name}
                  initialPresent={attendance ? attendance.present : true}
                  average={average}
                  prediction={predictionText}
                  atRisk={isAtRisk}
                />
              );
            })}
            {(!students || students.length === 0) && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-400">
                  Aucun élève inscrit dans cette section pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Comportement */}
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

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function AlertRow({ row }: { row: StudentAtRisk }) {
  const reasons: string[] = [];
  if (row.has_significant_drop) reasons.push("Baisse de moyenne");
  if (row.has_repeated_absences) reasons.push("Absences répétées");
  if (row.has_behavior_concerns) reasons.push("Comportement à surveiller");
  if (row.has_low_average) reasons.push("Moyenne faible");

  return (
    <div
      className={`rounded-lg p-3 border ${
        row.risk_level === "high" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-navy truncate">{row.full_name}</p>
          <p className="text-xs text-slate-600">{reasons.join(" · ")}</p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${RISK_LEVEL_COLOR[row.risk_level]}`}
        >
          {RISK_LEVEL_LABEL[row.risk_level]}
        </span>
      </div>
    </div>
  );
}