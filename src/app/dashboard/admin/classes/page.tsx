import AddLevelForm from "./add-level-form";
import AddSectionForm from "./add-section-form";
import SeedLevelsButton from "./seed-levels-button";
import { getSessionProfile } from "@/lib/auth/session";
import {
  fetchClassBalanceAlerts,
  fetchClassCapacitySummary,
  fetchClassSectionRosters,
  fetchTeacherWorkload,
  fillBarClass,
  fillCardClass,
  fillStatusLabel,
  summarizeFillStatus,
  workloadLabel,
  type ClassSectionRoster,
  type FillStatus,
} from "@/lib/classes-intelligence/scoring";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0;

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  section_id: string;
  subject: string;
  profiles: { id: string; full_name: string } | null;
};

type SectionWithTeachers = {
  id: string;
  name: string;
  capacity: number;
  seats_taken: number;
  homeroom_teacher_id: string | null;
  teacher_assignments: TeacherAssignment[];
  profiles: { id: string; full_name: string } | null;
};

export default async function AdminClassesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/admin/classes");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name, school_type")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const establishmentId = establishment?.id ?? "";

  const [{ data: levels }, summary, balanceAlerts, rosters, workload, teachersResult] =
    await Promise.all([
      supabase
        .from("levels")
        .select("*, sections(*, teacher_assignments(*, profiles(id, full_name)), profiles(id, full_name))")
        .eq("establishment_id", establishmentId)
        .order("rank"),
      establishment
        ? fetchClassCapacitySummary(supabase, establishment.id)
        : Promise.resolve(null),
      establishment
        ? fetchClassBalanceAlerts(supabase, establishment.id)
        : Promise.resolve([]),
      establishment
        ? fetchClassSectionRosters(supabase, establishment.id)
        : Promise.resolve([]),
      establishment
        ? fetchTeacherWorkload(supabase, establishment.id)
        : Promise.resolve([]),
      establishment
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .eq("establishment_id", establishment.id)
            .eq("role", "professeur")
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

  const allTeachers = teachersResult.data ?? [];
  const rosterBySection = new Map<string, ClassSectionRoster>(
    rosters.map((r) => [r.section_id, r])
  );

  const totalSections =
    levels?.reduce((s, l) => s + ((l.sections as SectionWithTeachers[])?.length ?? 0), 0) ?? 0;
  const totalTeachers = allTeachers.length;
  const assignedTeachers = new Set(
    levels?.flatMap(
      (l) =>
        (l.sections as SectionWithTeachers[])?.flatMap(
          (sec) => sec.teacher_assignments?.map((ta) => ta.teacher_id) ?? []
        ) ?? []
    )
  ).size;
  const unassignedTeachers = totalTeachers - assignedTeachers;
  const realStudentCount = rosters.reduce((s, r) => s + r.student_count, 0);
  const mismatchCount = rosters.filter((r) => r.seats_mismatch).length;
  const sectionsWithoutTeacher = rosters.filter((r) => r.teachers_count === 0).length;
  const sectionsWithoutHomeroom = rosters.filter((r) => !r.homeroom_teacher_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy">Classes &amp; effectifs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {establishment?.name ?? "Gestion des classes, sections et professeurs"}
          </p>
        </div>
        {establishment && (
          <Link
            href="/dashboard/admin/equipe"
            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors min-h-11"
          >
            Inviter un professeur
          </Link>
        )}
      </div>

      {!establishment && (
        <div className="card text-slate-500">
          Aucun établissement rattaché.{" "}
          <Link href="/onboarding/etablissement" className="text-amber-600 hover:underline">
            Créer un établissement
          </Link>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Élèves inscrits" value={realStudentCount} hint={`${summary.total_taken} places prises`} />
          <KpiCard label="Sections" value={totalSections} hint={`${summary.total_seats_available} places libres`} />
          <KpiCard
            label="Professeurs affectés"
            value={assignedTeachers}
            hint={unassignedTeachers > 0 ? `${unassignedTeachers} sans classe` : `${totalTeachers} dans l'équipe`}
          />
          <KpiCard label="Remplissage" value={`${summary.global_fill_rate_pct}%`} hint={`${summary.full_levels} niveau(x) complet(s)`} />
        </div>
      )}

      {establishment && (mismatchCount > 0 || sectionsWithoutTeacher > 0 || sectionsWithoutHomeroom > 0) && (
        <div className="card border-amber-200 bg-amber-50/40">
          <h2 className="font-semibold text-navy mb-2">Points d&apos;attention</h2>
          <ul className="text-sm text-slate-700 space-y-1">
            {sectionsWithoutTeacher > 0 && (
              <li>{sectionsWithoutTeacher} classe{sectionsWithoutTeacher > 1 ? "s" : ""} sans professeur affecté.</li>
            )}
            {sectionsWithoutHomeroom > 0 && (
              <li>{sectionsWithoutHomeroom} classe{sectionsWithoutHomeroom > 1 ? "s" : ""} sans titulaire.</li>
            )}
            {mismatchCount > 0 && (
              <li>
                {mismatchCount} classe{mismatchCount > 1 ? "s" : ""} : l&apos;effectif réel ne correspond pas au compteur de places.
              </li>
            )}
          </ul>
        </div>
      )}

      {totalTeachers > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Équipe enseignante</h2>
            {unassignedTeachers > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                {unassignedTeachers} non affecté{unassignedTeachers > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allTeachers.map((teacher) => {
              const assignedSections =
                levels?.flatMap(
                  (l) =>
                    (l.sections as SectionWithTeachers[])?.filter((sec) =>
                      sec.teacher_assignments?.some((ta) => ta.teacher_id === teacher.id)
                    ) ?? []
                ) ?? [];
              const subjects = [
                ...new Set(
                  levels?.flatMap(
                    (l) =>
                      (l.sections as SectionWithTeachers[])?.flatMap(
                        (sec) =>
                          sec.teacher_assignments
                            ?.filter((ta) => ta.teacher_id === teacher.id)
                            .map((ta) => ta.subject) ?? []
                      ) ?? []
                  ) ?? []
                ),
              ];
              const load = workload.find((w) => w.teacher_id === teacher.id);
              return (
                <div
                  key={teacher.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    assignedSections.length > 0
                      ? "bg-emerald-50/50 border-emerald-100"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {teacher.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{teacher.full_name}</p>
                    {assignedSections.length > 0 ? (
                      <p className="text-xs text-emerald-700 truncate">
                        {assignedSections.length} classe{assignedSections.length > 1 ? "s" : ""}
                        {subjects.length > 0 ? ` · ${subjects.slice(0, 2).join(", ")}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Non affecté</p>
                    )}
                    {load && (
                      <p className="text-[11px] text-slate-400">{workloadLabel(load.workload_level)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {balanceAlerts.length > 0 && (
        <div className="card border-amber-200">
          <h2 className="font-semibold text-navy mb-3">Alertes de déséquilibre</h2>
          <div className="space-y-2">
            {balanceAlerts.slice(0, 6).map((a) => (
              <Link
                key={a.section_id}
                href={`/dashboard/admin/classes/${a.section_id}`}
                className={`p-3 rounded-xl border flex items-center justify-between min-h-11 ${
                  a.alert_level === "critical"
                    ? "border-red-200 bg-red-50"
                    : a.alert_level === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-100 bg-slate-50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {a.level_name} · {a.section_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.seats_available} place(s) dispo · {fillStatusLabel(a.fill_status as FillStatus)}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-700 tabular-nums">{a.fill_rate_pct}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {establishment && (levels?.length ?? 0) === 0 && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-2">Aucune classe pour le moment</h2>
          <p className="text-sm text-slate-500 mb-4">
            Créez les niveaux de votre établissement
            {establishment.school_type ? " à partir du type choisi à l'onboarding" : ""}
            , ou ajoutez-les manuellement.
          </p>
          {establishment.school_type && <SeedLevelsButton />}
        </div>
      )}

      {establishment && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Ajouter un niveau</h2>
          <AddLevelForm establishmentId={establishment.id} />
        </div>
      )}

      <div className="space-y-5">
        {levels?.map((level) => {
          const sections = (level.sections as SectionWithTeachers[]) ?? [];
          const levelRosters = sections.map((s) => rosterBySection.get(s.id));
          const totalCapacity = sections.reduce((s, sec) => s + sec.capacity, 0);
          const totalTaken = levelRosters.reduce((s, r) => s + (r?.student_count ?? 0), 0);
          const levelRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;
          const levelStatus = summarizeFillStatus(levelRate);
          const levelTeachers = new Set(
            sections.flatMap((sec) => sec.teacher_assignments?.map((ta) => ta.teacher_id) ?? [])
          ).size;

          return (
            <div key={level.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg text-navy">{level.name}</h3>
                    <p className="text-xs text-slate-500">
                      {totalTaken} / {totalCapacity} élèves · {sections.length} classe
                      {sections.length > 1 ? "s" : ""} · {levelTeachers} professeur
                      {levelTeachers > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${fillBarClass(levelStatus)}`}
                        style={{ width: `${Math.min(100, levelRate)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-500 tabular-nums">{levelRate}%</span>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {sections.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sections.map((sec) => {
                      const roster = rosterBySection.get(sec.id);
                      const studentCount = roster?.student_count ?? sec.seats_taken;
                      const secRate =
                        sec.capacity > 0 ? Math.round((studentCount / sec.capacity) * 100) : 0;
                      const status = summarizeFillStatus(secRate);
                      const secTeachers = sec.teacher_assignments ?? [];
                      const homeroom = sec.profiles;

                      return (
                        <Link
                          key={sec.id}
                          href={`/dashboard/admin/classes/${sec.id}`}
                          className={`rounded-xl border p-4 transition-all hover:shadow-md block min-h-11 ${fillCardClass(status)}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{sec.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {homeroom
                                  ? `Titulaire : ${homeroom.full_name}`
                                  : "Pas de titulaire"}
                              </p>
                            </div>
                            {status === "full" && (
                              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                COMPLET
                              </span>
                            )}
                          </div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">
                                {studentCount} / {sec.capacity} élèves
                              </span>
                              <span className="text-xs font-bold text-slate-600 tabular-nums">{secRate}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${fillBarClass(status)}`}
                                style={{ width: `${Math.min(100, secRate)}%` }}
                              />
                            </div>
                          </div>
                          {secTeachers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {secTeachers.slice(0, 3).map((ta) => (
                                <span
                                  key={ta.id}
                                  className="text-[11px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full"
                                >
                                  {ta.profiles?.full_name?.split(" ")[0] ?? "?"} · {ta.subject}
                                </span>
                              ))}
                              {secTeachers.length > 3 && (
                                <span className="text-[11px] text-slate-500">+{secTeachers.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">Aucun professeur affecté</p>
                          )}
                          {roster?.seats_mismatch && (
                            <p className="text-[11px] text-amber-700 mt-2">
                              Compteur {sec.seats_taken} ≠ effectif {studentCount}
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-6 text-slate-400">Aucune section pour ce niveau</p>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <AddSectionForm levelId={level.id} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-navy mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
}
