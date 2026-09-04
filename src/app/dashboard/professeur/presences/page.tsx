import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function PresencesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur/presences");
  }

  // Récupérer les sections assignées au professeur
  const { data: assignments } = profile?.role === "professeur"
    ? await supabase
        .from("teacher_assignments")
        .select("section_id, subject, sections(id, name, capacity, seats_taken, levels(name))")
        .eq("teacher_id", profile.id)
    : { data: null };

  // Si admin, récupérer toutes les sections
  const { data: allSections } = profile?.role === "admin"
    ? await supabase
        .from("sections")
        .select("id, name, capacity, seats_taken, levels(name)")
    : { data: null };

  const sections = profile?.role === "admin"
    ? allSections ?? []
    : (assignments ?? []).map((a) => ({
        id: a.section_id,
        name: (a.sections as unknown as { name: string })?.name ?? "",
        capacity: (a.sections as unknown as { capacity: number })?.capacity ?? 0,
        seats_taken: (a.sections as unknown as { seats_taken: number })?.seats_taken ?? 0,
        levels: (a.sections as unknown as { levels: { name: string } | null })?.levels ?? null,
      }));

  // Stats de présence récentes par section
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const sectionIds = sections.map((s) => s.id);
  const { data: recentAttendance } = sectionIds.length > 0
    ? await supabase
        .from("attendance_records")
        .select("section_id, present, session_date")
        .in("section_id", sectionIds)
        .gte("session_date", thirtyDaysAgo)
    : { data: null };

  // Calcul des stats par section
  const statsMap = new Map<string, { total: number; present: number; todayDone: boolean }>();
  for (const rec of recentAttendance ?? []) {
    const stat = statsMap.get(rec.section_id) ?? { total: 0, present: 0, todayDone: false };
    stat.total++;
    if (rec.present) stat.present++;
    if (rec.session_date === today) stat.todayDone = true;
    statsMap.set(rec.section_id, stat);
  }

  const todayRecords = (recentAttendance ?? []).filter((r) => r.session_date === today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">✅ Gestion des présences</h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats du jour */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <p className="text-3xl mb-1">🟢</p>
          <p className="text-2xl font-bold text-emerald-700">
            {todayRecords.filter((r) => r.present).length}
          </p>
          <p className="text-xs text-emerald-600">Présents aujourd&apos;hui</p>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <p className="text-3xl mb-1">🔴</p>
          <p className="text-2xl font-bold text-red-700">
            {todayRecords.filter((r) => !r.present).length}
          </p>
          <p className="text-xs text-red-600">Absents aujourd&apos;hui</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <p className="text-3xl mb-1">📋</p>
          <p className="text-2xl font-bold text-blue-700">{sections.length}</p>
          <p className="text-xs text-blue-600">Mes classes</p>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <p className="text-3xl mb-1">⏳</p>
          <p className="text-2xl font-bold text-amber-700">
            {sections.length - [...statsMap.values()].filter((s) => s.todayDone).length}
          </p>
          <p className="text-xs text-amber-600">À faire</p>
        </div>
      </div>

      {/* Liste des classes */}
      <div className="space-y-3">
        <h2 className="font-semibold text-navy text-sm uppercase tracking-wide">
          Choisir une classe pour la présence
        </h2>
        {sections.map((section) => {
          const stat = statsMap.get(section.id);
          const rate = stat && stat.total > 0
            ? Math.round((stat.present / stat.total) * 100)
            : null;
          const todayDone = stat?.todayDone ?? false;

          return (
            <Link
              key={section.id}
              href={`/dashboard/professeur/classe/${section.id}`}
              className={`block p-4 rounded-2xl border transition-all hover:shadow-md ${
                todayDone
                  ? "bg-white border-emerald-200"
                  : "bg-white border-slate-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      todayDone
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {todayDone ? "✓" : "📝"}
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-sm">
                      {(section.levels as unknown as { name: string } | null)?.name ?? ""}{" "}
                      {section.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {section.seats_taken} / {section.capacity} élèves
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {rate !== null ? (
                    <div>
                      <p
                        className={`text-lg font-bold ${
                          rate >= 90
                            ? "text-emerald-600"
                            : rate >= 75
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {rate}%
                      </p>
                      <p className="text-[10px] text-slate-400">30 jours</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">—</p>
                  )}
                  {todayDone && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                      FAIT
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {sections.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-3">📚</p>
            <p>Aucune classe assignée.</p>
          </div>
        )}
      </div>
    </div>
  );
}
