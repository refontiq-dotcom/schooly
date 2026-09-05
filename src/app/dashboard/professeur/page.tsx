import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
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

const darkRiskColor: Record<string, string> = {
  low: "bg-[#0f3d2e]/60 text-[#6ddba4]",
  medium: "bg-[#4a3213]/60 text-[#f2c98a]",
  high: "bg-[#4a2626]/60 text-[#f28b82]",
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
      <div className="rounded-3xl border border-accent-primary/20 bg-gradient-to-br from-[#004a77] via-[#0b3d63] to-[#131314] p-6 lg:p-8 text-text relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent-primary/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        <div className="relative">
          <p className="gemini-gradient-text text-lg font-semibold">
            {greeting}, {profile?.full_name?.split(" ")[0] ?? "Professeur"} 👋
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1">
            Tableau de bord
          </h1>
          <p className="text-sm text-muted mt-2">
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
              <div className="rounded-2xl bg-hover/80 backdrop-blur-sm px-4 py-3 border border-subtle">
                <p className="text-2xl font-bold">{workloadTyped.classes_count}</p>
                <p className="text-xs text-muted">Classes</p>
              </div>
            )}
            <div className="rounded-2xl bg-hover/80 backdrop-blur-sm px-4 py-3 border border-subtle">
              <p className="text-2xl font-bold">{visibleSectionIds.length}</p>
              <p className="text-xs text-muted">Sections</p>
            </div>
            {highRisk.length + mediumRisk.length > 0 && (
              <div className="rounded-2xl bg-[#4a2626]/40 backdrop-blur-sm px-4 py-3 border border-[#f28b82]/25">
                <p className="text-2xl font-bold text-[#f28b82]">{highRisk.length + mediumRisk.length}</p>
                <p className="text-xs text-[#f28b82]/70">Alertes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workload & pending grades row */}
      {workloadTyped && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <WorkloadCard label="Charge" value={workloadLabel(workloadTyped.workload_level)} tone={workloadTyped.workload_level === "high" ? "red" : "green"} />
          <WorkloadCard label="Élèves" value={workloadTyped.homeroom_students} tone="blue" />
          <WorkloadCard label="Notes 7j" value={workloadTyped.grades_recorded_7d} tone="violet" />
          <WorkloadCard label="Cours" value={workloadTyped.class_subject_pairs} tone="amber" />
        </div>
      )}

      {/* Urgent pending grades */}
      {urgentPending.length > 0 && (
        <div className="rounded-3xl border border-[#5c420e]/60 bg-[#2b2013] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#4a3213]/70 flex items-center justify-center text-xl">⏰</div>
            <div>
              <h2 className="font-bold text-[#f2c98a]">{urgentPending.length} note(s) en retard</h2>
              <p className="text-xs text-muted">Saisissez les résultats pour garder les parents informés</p>
            </div>
          </div>
          <div className="space-y-2">
            {urgentPending.slice(0, 4).map((p) => (
              <Link
                key={`${p.section_id}-${p.subject}-${p.session_date}`}
                href={`/dashboard/professeur/classe/${p.section_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[#4a3213]/40 p-3 hover:bg-[#4a3213]/70 transition-all duration-200 group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#f2c98a] text-sm">{p.section_name} · {p.subject}</p>
                  <p className="text-xs text-muted">
                    Session du {p.session_date} — il y a {p.days_ago}j
                  </p>
                </div>
                <span className="text-xs font-bold text-[#f2c98a] bg-[#4a3213] px-3 py-1.5 rounded-full group-hover:brightness-110 transition-all duration-200">
                  Saisir →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {highRisk.length > 0 && (
        <div className="rounded-3xl border border-[#5f2120]/60 bg-[#2d1a1a] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#4a2626]/70 flex items-center justify-center text-xl">🚨</div>
            <div>
              <h2 className="font-bold text-[#f28b82]">
                {highRisk.length} élève(s) en danger
              </h2>
              <p className="text-xs text-muted">Décrochage détecté — action immédiate recommandée</p>
            </div>
          </div>
          <div className="space-y-2">
            {highRisk.slice(0, 5).map((r: StudentAtRisk) => (
              <Link
                key={r.student_id}
                href={`/dashboard/professeur/classe/${r.section_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[#4a2626]/40 p-3 hover:bg-[#4a2626]/70 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#4a2626] flex items-center justify-center text-[#f28b82] font-bold text-sm shrink-0">
                    {r.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text text-sm truncate">{r.full_name}</p>
                    <p className="text-xs text-muted">
                      {r.section_name} · {Number(r.current_average).toFixed(1)}/20
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${darkRiskColor[r.risk_level]}`}>
                  {RISK_LEVEL_LABEL[r.risk_level]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {mediumRisk.length > 0 && !urgentPending.length && (
        <div className="rounded-3xl border border-[#5c420e]/60 bg-[#2b2013] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#4a3213]/70 flex items-center justify-center text-xl">⚠️</div>
            <div>
              <h2 className="font-bold text-[#f2c98a]">
                {mediumRisk.length} élève(s) à surveiller
              </h2>
              <p className="text-xs text-muted">Signes faibles de décrochage</p>
            </div>
          </div>
          <div className="space-y-2">
            {mediumRisk.slice(0, 5).map((r: StudentAtRisk) => (
              <Link
                key={r.student_id}
                href={`/dashboard/professeur/classe/${r.section_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[#4a3213]/40 p-3 hover:bg-[#4a3213]/70 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#4a3213] flex items-center justify-center text-[#f2c98a] font-bold text-sm shrink-0">
                    {r.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text text-sm truncate">{r.full_name}</p>
                    <p className="text-xs text-muted">
                      {r.section_name} · {Number(r.current_average).toFixed(1)}/20
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${darkRiskColor[r.risk_level]}`}>
                  {RISK_LEVEL_LABEL[r.risk_level]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Class cards grid */}
      <div>
        <h2 className="font-bold text-text text-lg mb-4">Mes classes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels?.map((level) => {
            const allSections = (level.sections ?? []) as { id: string; name: string; capacity: number; seats_taken: number }[];
            const sections =
              assignedSectionIds === null
                ? allSections
                : allSections.filter((s) => assignedSectionIds.includes(s.id));
            if (assignedSectionIds !== null && sections.length === 0) return null;

            return (
              <div key={level.id} className="rounded-3xl border border-subtle bg-surface p-5 transition-all duration-200 hover:border-accent-primary/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent-active flex items-center justify-center text-accent-text font-bold text-sm">
                    {level.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-text">{level.name}</h3>
                    <p className="text-xs text-muted">{sections.length} section(s)</p>
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
                        className="block p-3 rounded-2xl bg-hover hover:bg-subtle transition-all duration-200 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-accent-primary shrink-0" />
                            <span className="text-sm font-semibold text-text group-hover:text-accent-text transition-colors duration-200">
                              {sec.name}
                            </span>
                          </div>
                          {avg !== null && avg > 0 && (
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                avg >= 12
                                  ? "text-[#6ddba4]"
                                  : avg >= 10
                                  ? "text-[#f2c98a]"
                                  : "text-[#f28b82]"
                              }`}
                            >
                              {avg.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-200 ${
                                fillPct >= 90 ? "bg-[#f28b82]" : fillPct >= 70 ? "bg-[#f2c98a]" : "bg-[#6ddba4]"
                              }`}
                              style={{ width: `${Math.min(100, fillPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted tabular-nums">
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
            <div className="rounded-3xl border border-dashed border-subtle bg-surface p-8 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-text font-medium">Aucune classe assignée</p>
              <p className="text-sm text-muted mt-1">
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
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  const toneMap: Record<string, { badge: string; text: string }> = {
    green: { badge: "bg-[#0f3d2e]/50 text-[#6ddba4]", text: "text-[#6ddba4]" },
    red: { badge: "bg-[#4a2626]/50 text-[#f28b82]", text: "text-[#f28b82]" },
    blue: { badge: "bg-accent-active/60 text-accent-text", text: "text-accent-primary" },
    violet: { badge: "bg-accent-active/40 text-accent-text", text: "text-accent-primary" },
    amber: { badge: "bg-[#4a3213]/50 text-[#f2c98a]", text: "text-[#f2c98a]" },
    slate: { badge: "bg-hover text-muted", text: "text-text" },
  };
  const c = toneMap[tone] ?? toneMap.slate;

  return (
    <div className="rounded-3xl border border-subtle bg-surface p-4 transition-all duration-200 hover:border-accent-primary/30">
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
        {label}
      </span>
      <p className={`text-xl font-bold mt-2 ${c.text}`}>{value}</p>
    </div>
  );
}
