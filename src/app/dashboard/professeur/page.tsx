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

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Bonjour"
      : now.getHours() < 18
      ? "Bon après-midi"
      : "Bonsoir";

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="bg-gradient-to-r from-[#0E2D52] via-[#153A6B] to-[#1A4580] rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <p className="text-lg font-medium opacity-80">
            {greeting}, {profile?.full_name?.split(" ")[0] ?? "Professeur"} 👋
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">
            Tableau de bord
          </h1>
          <p className="text-sm opacity-60 mt-2">
            {now.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {/* Quick stats in hero */}
          <div className="flex flex-wrap gap-4 mt-5">
            {workloadTyped && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3">
                <p className="text-2xl font-bold">{workloadTyped.classes_count}</p>
                <p className="text-xs opacity-60">Classes</p>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3">
              <p className="text-2xl font-bold">{visibleSectionIds.length}</p>
              <p className="text-xs opacity-60">Sections</p>
            </div>
            {highRisk.length + mediumRisk.length > 0 && (
              <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl px-4 py-3">
                <p className="text-2xl font-bold text-red-300">{highRisk.length + mediumRisk.length}</p>
                <p className="text-xs text-red-200/60">Alertes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workload & pending grades row */}
      {workloadTyped && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <WorkloadCard label="Charge" value={workloadLabel(workloadTyped.workload_level)} color={workloadTyped.workload_level === "high" ? "red" : "green"} />
          <WorkloadCard label="Élèves" value={workloadTyped.homeroom_students} color="blue" />
          <WorkloadCard label="Notes 7j" value={workloadTyped.grades_recorded_7d} color="violet" />
          <WorkloadCard label="Cours" value={workloadTyped.class_subject_pairs} color="amber" />
        </div>
      )}

      {/* Urgent pending grades */}
      {urgentPending.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">⏰</div>
            <div>
              <h2 className="font-bold text-amber-900">{urgentPending.length} note(s) en retard</h2>
              <p className="text-xs text-amber-600">Saisissez les résultats pour garder les parents informés</p>
            </div>
          </div>
          <div className="space-y-2">
            {urgentPending.slice(0, 4).map((p) => (
              <Link
                key={`${p.section_id}-${p.subject}-${p.session_date}`}
                href={`/dashboard/professeur/classe/${p.section_id}`}
                className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 hover:shadow-md transition-all group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy text-sm">{p.section_name} · {p.subject}</p>
                  <p className="text-xs text-slate-400">
                    Session du {p.session_date} — il y a {p.days_ago}j
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg group-hover:bg-amber-200 transition-colors">
                  Saisir →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {highRisk.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl">🚨</div>
            <div>
              <h2 className="font-bold text-red-900">
                {highRisk.length} élève(s) en danger
              </h2>
              <p className="text-xs text-red-600">Décrochage détecté — action immédiate recommandée</p>
            </div>
          </div>
          <div className="space-y-2">
            {highRisk.slice(0, 5).map((r: StudentAtRisk) => (
              <Link
                key={r.student_id}
                href={`/dashboard/professeur/classe/${r.section_id}`}
                className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                    {r.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{r.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {r.section_name} · {Number(r.current_average).toFixed(1)}/20
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${RISK_LEVEL_COLOR[r.risk_level]}`}>
                  {RISK_LEVEL_LABEL[r.risk_level]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {mediumRisk.length > 0 && !urgentPending.length && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">⚠️</div>
            <div>
              <h2 className="font-bold text-amber-900">
                {mediumRisk.length} élève(s) à surveiller
              </h2>
              <p className="text-xs text-amber-600">Signes faibles de décrochage</p>
            </div>
          </div>
          <div className="space-y-2">
            {mediumRisk.slice(0, 5).map((r: StudentAtRisk) => (
              <Link
                key={r.student_id}
                href={`/dashboard/professeur/classe/${r.section_id}`}
                className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm shrink-0">
                    {r.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-navy text-sm truncate">{r.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {r.section_name} · {Number(r.current_average).toFixed(1)}/20
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${RISK_LEVEL_COLOR[r.risk_level]}`}>
                  {RISK_LEVEL_LABEL[r.risk_level]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Class cards grid */}
      <div>
        <h2 className="font-bold text-navy text-lg mb-4">Mes classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels?.map((level) => {
            const allSections = (level.sections ?? []) as { id: string; name: string; capacity: number; seats_taken: number }[];
            const sections =
              assignedSectionIds === null
                ? allSections
                : allSections.filter((s) => assignedSectionIds.includes(s.id));
            if (assignedSectionIds !== null && sections.length === 0) return null;

            return (
              <div key={level.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                    {level.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-navy">{level.name}</h3>
                    <p className="text-xs text-slate-400">{sections.length} section(s)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {sections.map((sec) => {
                    const d = dashMap.get(sec.id);
                    const avg = d ? Number(d.class_average) : null;
                    const fillPct = sec.capacity > 0 ? Math.round((sec.seats_taken / sec.capacity) * 100) : 0;

                    return (
                      <Link
                        key={sec.id}
                        href={`/dashboard/professeur/classe/${sec.id}`}
                        className="block p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                            <span className="text-sm font-semibold text-navy group-hover:text-blue-700 transition-colors">
                              {sec.name}
                            </span>
                          </div>
                          {avg !== null && avg > 0 && (
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                avg >= 12
                                  ? "text-emerald-600"
                                  : avg >= 10
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {avg.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                fillPct >= 90 ? "bg-red-400" : fillPct >= 70 ? "bg-amber-400" : "bg-blue-400"
                              }`}
                              style={{ width: `${Math.min(100, fillPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {sec.seats_taken}/{sec.capacity}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {assignedSectionIds !== null && assignedSectionIds.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-slate-500 font-medium">Aucune classe assignée</p>
              <p className="text-sm text-slate-400 mt-1">
                L&apos;administrateur doit vous assigner une section
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkloadCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    green: { bg: "from-emerald-50 to-emerald-100", text: "text-emerald-700", ring: "border-emerald-200" },
    red: { bg: "from-red-50 to-red-100", text: "text-red-700", ring: "border-red-200" },
    blue: { bg: "from-blue-50 to-blue-100", text: "text-blue-700", ring: "border-blue-200" },
    violet: { bg: "from-violet-50 to-violet-100", text: "text-violet-700", ring: "border-violet-200" },
    amber: { bg: "from-amber-50 to-amber-100", text: "text-amber-700", ring: "border-amber-200" },
    slate: { bg: "from-slate-50 to-slate-100", text: "text-slate-700", ring: "border-slate-200" },
  };
  const c = colorMap[color] ?? colorMap.slate;

  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.ring} rounded-2xl p-4`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
