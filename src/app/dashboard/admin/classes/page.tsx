import AddLevelForm from "./add-level-form";
import AddSectionForm from "./add-section-form";
import { getSessionProfile } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0;

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  section_id: string;
  subject: string;
  profiles: {
    id: string;
    full_name: string;
  } | null;
};

type SectionWithTeachers = {
  id: string;
  name: string;
  capacity: number;
  seats_taken: number;
  homeroom_teacher_id: string | null;
  teacher_assignments: TeacherAssignment[];
  profiles: {
    id: string;
    full_name: string;
  } | null;
};

export default async function AdminClassesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/admin/classes");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: levels } = await supabase
    .from("levels")
    .select("*, sections(*, teacher_assignments(*, profiles(id, full_name)), profiles(id, full_name))")
    .eq("establishment_id", establishment?.id ?? "")
    .order("rank");

  const { data: summary } = establishment
    ? await supabase
        .from("class_capacity_summary")
        .select("*")
        .eq("establishment_id", establishment.id)
        .maybeSingle()
    : { data: null };

  const { data: balanceAlerts } = establishment
    ? await supabase
        .from("class_balance_alerts")
        .select("*")
        .eq("establishment_id", establishment.id)
        .order("alert_level", { ascending: false })
        .limit(6)
    : { data: [] };

  // Récupérer tous les professeurs de l'établissement
  const { data: allTeachers } = establishment
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("establishment_id", establishment.id)
        .eq("role", "professeur")
    : { data: [] };

  // Calculer les stats globales
  const totalSections = levels?.reduce((s, l) => s + ((l.sections as SectionWithTeachers[])?.length ?? 0), 0) ?? 0;
  const totalTeachers = allTeachers?.length ?? 0;
  const assignedTeachers = new Set(
    levels?.flatMap((l) =>
      (l.sections as SectionWithTeachers[])?.flatMap((sec) =>
        sec.teacher_assignments?.map((ta) => ta.teacher_id) ?? []
      ) ?? []
    )
  ).size;
  const unassignedTeachers = totalTeachers - assignedTeachers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy">
            Classes & effectifs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {establishment?.name ?? "Gestion des classes, sections et professeurs"}
          </p>
        </div>
        {establishment && (
          <Link
            href="/dashboard/admin/equipe"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
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

      {/* ── Stats globales ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <span className="text-lg">👥</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{summary.total_taken}</p>
                <p className="text-xs text-slate-500">Élèves inscrits</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span className="text-lg">📐</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{totalSections}</p>
                <p className="text-xs text-slate-500">Sections</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <span className="text-lg">👨‍🏫</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{assignedTeachers}</p>
                <p className="text-xs text-slate-500">Professeurs affectés</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="text-lg">🎯</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{summary.global_fill_rate_pct}%</p>
                <p className="text-xs text-slate-500">Remplissage</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Répartition des professeurs ── */}
      {totalTeachers > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              👨‍🏫 Équipe enseignante
            </h2>
            {unassignedTeachers > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                {unassignedTeachers} non affecté{unassignedTeachers > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allTeachers?.map((teacher) => {
              // Trouver les sections assignées à ce professeur
              const assignedSections = levels?.flatMap((l) =>
                (l.sections as SectionWithTeachers[])?.filter((sec) =>
                  sec.teacher_assignments?.some((ta) => ta.teacher_id === teacher.id)
                ) ?? []
              ) ?? [];

              const subjects = levels?.flatMap((l) =>
                (l.sections as SectionWithTeachers[])?.flatMap((sec) =>
                  sec.teacher_assignments
                    ?.filter((ta) => ta.teacher_id === teacher.id)
                    .map((ta) => ta.subject) ?? []
                ) ?? []
              ) ?? [];

              const uniqueSubjects = [...new Set(subjects)];

              return (
                <div
                  key={teacher.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    assignedSections.length > 0
                      ? "bg-emerald-50/50 border-emerald-100"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                    {teacher.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {teacher.full_name}
                    </p>
                    {assignedSections.length > 0 ? (
                      <p className="text-xs text-emerald-600 truncate">
                        {assignedSections.length} section{assignedSections.length > 1 ? "s" : ""} · {uniqueSubjects.slice(0, 2).join(", ")}
                        {uniqueSubjects.length > 2 && ` +${uniqueSubjects.length - 2}`}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">Non affecté</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bandeau intelligence */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="card">
            <p className="text-xs text-slate-500">Remplissage global</p>
            <p className="text-2xl font-bold text-navy mt-1">{summary.global_fill_rate_pct}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {summary.total_taken} / {summary.total_capacity} places
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Places disponibles</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.total_seats_available}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.total_sections} section(s)</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Niveaux complets</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.full_levels}</p>
            <p className="text-xs text-slate-400 mt-1">à fermer / ouvrir</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Niveaux sous-remplis</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.low_levels}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.normal_levels} normaux</p>
          </div>
        </div>
      )}

      {/* Alertes de déséquilibre */}
      {balanceAlerts && balanceAlerts.length > 0 && (
        <div className="card border-amber-200">
          <h2 className="font-semibold text-navy mb-3">⚠️ Alertes de déséquilibre</h2>
          <div className="space-y-2">
            {balanceAlerts.map((a) => (
              <div
                key={a.section_id}
                className={`p-3 rounded-xl border flex items-center justify-between ${
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
                    {a.seats_available} place(s) dispo ·{" "}
                    {a.fill_status === "full"
                      ? "section complète"
                      : a.fill_status === "low"
                      ? "sous-remplissage"
                      : "presque complète"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{a.fill_rate_pct}%</span>
                  {a.alert_level === "critical" && (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                      Critique
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ajouter un niveau */}
      {establishment && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">➕ Ajouter un niveau</h2>
          <AddLevelForm establishmentId={establishment.id} />
        </div>
      )}

      {/* ── Liste des niveaux avec sections et professeurs ── */}
      <div className="space-y-5">
        {levels?.map((level) => {
          const sections = (level.sections as SectionWithTeachers[]) ?? [];
          const totalCapacity = sections.reduce((s, sec) => s + sec.capacity, 0);
          const totalTaken = sections.reduce((s, sec) => s + sec.seats_taken, 0);
          const levelRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;
          const levelTeachers = new Set(
            sections.flatMap((sec) => sec.teacher_assignments?.map((ta) => ta.teacher_id) ?? [])
          ).size;

          return (
            <div key={level.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Header du niveau */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                      levelRate >= 100 ? "bg-red-100 text-red-600"
                      : levelRate >= 90 ? "bg-amber-100 text-amber-600"
                      : levelRate >= 70 ? "bg-emerald-100 text-emerald-600"
                      : "bg-slate-100 text-slate-600"
                    }`}>
                      {sections.length}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-navy">{level.name}</h3>
                      <p className="text-xs text-slate-500">
                        {totalTaken} / {totalCapacity} élèves · {levelTeachers} professeur{levelTeachers > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          levelRate >= 100 ? "bg-red-500" :
                          levelRate >= 90 ? "bg-amber-500" :
                          levelRate < 50 ? "bg-orange-400" :
                          "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(100, levelRate)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-500 tabular-nums">
                      {levelRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div className="p-5">
                {sections.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sections.map((sec) => {
                      const secRate = sec.capacity > 0 ? Math.round((sec.seats_taken / sec.capacity) * 100) : 0;
                      const secTeachers = sec.teacher_assignments ?? [];
                      const homeroom = sec.profiles;

                      return (
                        <div
                          key={sec.id}
                          className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                            secRate >= 100
                              ? "border-red-200 bg-red-50/50"
                              : secRate >= 90
                              ? "border-amber-200 bg-amber-50/50"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          {/* Section header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                secRate >= 100 ? "bg-red-100 text-red-600"
                                : secRate >= 90 ? "bg-amber-100 text-amber-600"
                                : "bg-slate-100 text-slate-600"
                              }`}>
                                {sec.name.slice(-2)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{sec.name}</p>
                                {homeroom && (
                                  <p className="text-[11px] text-slate-400">
                                    Titulaire : {homeroom.full_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            {secRate >= 100 && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                COMPLET
                              </span>
                            )}
                          </div>

                          {/* Barre de remplissage */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">
                                {sec.seats_taken} / {sec.capacity}
                              </span>
                              <span className={`text-xs font-bold ${
                                secRate >= 100 ? "text-red-600"
                                : secRate >= 90 ? "text-amber-600"
                                : "text-emerald-600"
                              }`}>
                                {secRate}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  secRate >= 100 ? "bg-red-500"
                                  : secRate >= 90 ? "bg-amber-500"
                                  : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, secRate)}%` }}
                              />
                            </div>
                          </div>

                          {/* Professeurs */}
                          {secTeachers.length > 0 ? (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase">
                                Professeurs
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {secTeachers.slice(0, 3).map((ta) => (
                                  <span
                                    key={ta.id}
                                    className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                                  >
                                    <span className="font-medium">{ta.profiles?.full_name?.split(" ")[0] ?? "?"}</span>
                                    <span className="text-blue-400">· {ta.subject}</span>
                                  </span>
                                ))}
                                {secTeachers.length > 3 && (
                                  <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                    +{secTeachers.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <p className="text-[11px] text-slate-400 italic">Aucun professeur affecté</p>
                            </div>
                          )}

                          {/* Places restantes visuelles */}
                          <div className="mt-3 flex gap-1">
                            {Array.from({ length: Math.min(sec.capacity, 10) }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-full h-1.5 rounded-full ${
                                  i < sec.seats_taken
                                    ? secRate >= 100 ? "bg-red-400"
                                    : secRate >= 90 ? "bg-amber-400"
                                    : "bg-emerald-400"
                                    : "bg-slate-100"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    Aucune section pour ce niveau
                  </div>
                )}

                {/* Ajouter une section */}
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
