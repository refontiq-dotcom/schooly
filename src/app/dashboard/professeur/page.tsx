import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
} from "@/lib/teacher-intelligence/scoring";
import {
  workloadLabel,
  pendingGradeUrgency,
} from "@/lib/teacher-intelligence/scoring-v2";
import type {
  TeacherWorkloadSummary,
  TeacherPendingGrade,
} from "@/lib/teacher-intelligence/scoring-v2";

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
  risk_level: "low" | "medium" | "high";
};

export default async function ProfesseurDashboardPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur");
  }

  const isAdmin = profile?.role === "admin";
  const teacherId = profile?.id ?? "";

  const assignedSectionIds = isAdmin
    ? null
    : (
        await supabase
          .from("teacher_assignments")
          .select("section_id")
          .eq("teacher_id", teacherId)
      ).data?.map((a) => a.section_id) ?? [];

  let levelsQuery = supabase
    .from("levels")
    .select("id, name, rank, sections(id, name, capacity, seats_taken)")
    .order("rank");

  if (profile?.establishment_id) {
    levelsQuery = levelsQuery.eq("establishment_id", profile.establishment_id);
  }

  const { data: levels } = await levelsQuery;

  const visibleSectionIds =
    assignedSectionIds === null
      ? (levels ?? []).flatMap((l) => (l.sections ?? []).map((s) => s.id))
      : assignedSectionIds;

  const [
    { data: dashboards },
    { data: atRisk },
    { data: workload },
    { data: pendingGrades },
  ] = await Promise.all([
    visibleSectionIds.length > 0
      ? supabase.from("class_dashboard").select("*").in("section_id", visibleSectionIds)
      : { data: [] },
    visibleSectionIds.length > 0
      ? supabase.from("students_at_risk").select("*").in("section_id", visibleSectionIds)
      : { data: [] },
    isAdmin
      ? { data: null }
      : supabase
          .from("teacher_workload_summary")
          .select("*")
          .eq("teacher_id", teacherId)
          .maybeSingle(),
    isAdmin
      ? { data: [] }
      : supabase
          .from("teacher_pending_grades")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("session_date", { ascending: false })
          .limit(8),
  ]);

  const dashMap = new Map<string, ClassDashboard>();
  for (const d of dashboards ?? []) {
    dashMap.set(d.section_id, d as ClassDashboard);
  }

  const highRisk = (atRisk ?? []).filter((r: StudentAtRisk) => r.risk_level === "high");
  const mediumRisk = (atRisk ?? []).filter((r: StudentAtRisk) => r.risk_level === "medium");
  const workloadTyped = workload as TeacherWorkloadSummary | null;
  const pendingTyped = (pendingGrades ?? []) as TeacherPendingGrade[];
  const urgentPending = pendingTyped.filter((p) => pendingGradeUrgency(p.days_ago) === "urgent");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Mes classes</h1>
        <p className="text-slate-500">
          Sélectionnez un niveau puis une section pour marquer les présences et saisir les notes.
        </p>
      </div>

      {/* Bandeau intelligence prof (sauf admin) */}
      {workloadTyped && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiMini label="Classes" value={workloadTyped.classes_count} sub={`${workloadTyped.subjects_count} matière(s)`} />
          <KpiMini label="Élèves homeroom" value={workloadTyped.homeroom_students} sub="prof principal" />
          <KpiMini
            label="Notes 7j"
            value={workloadTyped.grades_recorded_7d}
            sub={`${workloadTyped.attendance_records_7d} présences`}
          />
          <KpiMini
            label="Charge"
            value={workloadLabel(workloadTyped.workload_level)}
            sub={`${workloadTyped.class_subject_pairs} cours`}
            color={workloadTyped.workload_level === "high" ? "red" : "slate"}
          />
        </div>
      )}

      {/* Retards de saisie (notes en attente) */}
      {urgentPending.length > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-800 mb-3">
            ⏰ {urgentPending.length} note(s) en retard de saisie
          </h2>
          <div className="space-y-2">
            {urgentPending.slice(0, 5).map((p) => (
              <div
                key={`${p.section_id}-${p.subject}-${p.session_date}`}
                className="flex items-center justify-between gap-3 bg-white rounded p-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-navy truncate">
                    {p.section_name} · {p.subject}
                  </p>
                  <p className="text-xs text-slate-500">
                    Session du {p.session_date} (il y a {p.days_ago} jours)
                  </p>
                </div>
                <Link
                  href={`/dashboard/professeur/classe/${p.section_id}`}
                  className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap"
                >
                  Saisir →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertes globales */}
      {(highRisk.length > 0 || mediumRisk.length > 0) && (
        <div className="card border-red-200 bg-red-50">
          <h2 className="font-semibold text-red-800 mb-3">
            🚨 Alertes ({highRisk.length} critiques · {mediumRisk.length} à surveiller)
          </h2>
          <div className="space-y-2">
            {[...highRisk, ...mediumRisk].slice(0, 10).map((r: StudentAtRisk) => (
              <div key={r.student_id} className="flex items-center justify-between gap-3 bg-white rounded p-2">
                <div className="min-w-0">
                  <p className="font-medium text-navy truncate">{r.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {r.section_name} · moyenne actuelle {Number(r.current_average).toFixed(2)}/20
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${RISK_LEVEL_COLOR[r.risk_level]}`}>
                    {RISK_LEVEL_LABEL[r.risk_level]}
                  </span>
                  <Link
                    href={`/dashboard/professeur/classe/${r.section_id}`}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    Voir →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {levels?.map((level) => {
          const allSections = (level.sections ?? []) as { id: string; name: string }[];
          const sections =
            assignedSectionIds === null
              ? allSections
              : allSections.filter((s) => assignedSectionIds.includes(s.id));
          if (assignedSectionIds !== null && sections.length === 0) return null;
          return (
            <div key={level.id} className="card">
              <h2 className="font-semibold text-navy mb-3">{level.name}</h2>
              <div className="flex flex-wrap gap-2">
                {sections.map((sec) => {
                  const d = dashMap.get(sec.id);
                  return (
                    <Link
                      key={sec.id}
                      href={`/dashboard/professeur/classe/${sec.id}`}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      {sec.name}
                      {d && Number(d.class_average) > 0 && (
                        <span className="ml-2 text-xs text-slate-400 tabular-nums">
                          {Number(d.class_average).toFixed(1)}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {sections.length === 0 && (
                  <span className="text-sm text-slate-400">Aucune section configurée</span>
                )}
              </div>
            </div>
          );
        })}
        {assignedSectionIds !== null && assignedSectionIds.length === 0 && (
          <div className="card text-slate-500 sm:col-span-2 lg:col-span-3">
            Aucune classe ne vous a encore été affectée. L&apos;administrateur doit
            vous assigner une section depuis l&apos;espace direction.
          </div>
        )}
        {assignedSectionIds === null && (!levels || levels.length === 0) && (
          <div className="card text-slate-500 sm:col-span-2 lg:col-span-3">
            Aucun niveau configuré. Rendez-vous dans l&apos;espace administrateur pour créer les
            classes.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiMini({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string | number;
  sub: string;
  color?: "slate" | "red" | "amber" | "green";
}) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-700",
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
  };
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
