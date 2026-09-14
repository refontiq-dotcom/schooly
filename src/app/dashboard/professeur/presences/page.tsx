import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function PresencesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur/presences");
  }

  const { data: assignments } = profile?.role === "professeur"
    ? await supabase
        .from("teacher_assignments")
        .select("section_id, subject, sections(id, name, capacity, seats_taken, levels(name))")
        .eq("teacher_id", profile.id)
    : { data: null };

  const { data: allSections } = profile?.role === "admin"
    ? await supabase
        .from("sections")
        .select("id, name, capacity, seats_taken, levels(name)")
    : { data: null };

  const sections = profile?.role === "admin"
    ? (allSections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        seats_taken: s.seats_taken,
        levels: (s as unknown as { levels: { name: string } | null }).levels ?? null,
      }))
    : (assignments ?? []).map((a) => ({
        id: a.section_id,
        name: (a.sections as unknown as { name: string })?.name ?? "",
        capacity: (a.sections as unknown as { capacity: number })?.capacity ?? 0,
        seats_taken: (a.sections as unknown as { seats_taken: number })?.seats_taken ?? 0,
        levels: (a.sections as unknown as { levels: { name: string } | null })?.levels ?? null,
      }));

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

  const statsMap = new Map<string, { total: number; present: number; todayDone: boolean }>();
  for (const rec of recentAttendance ?? []) {
    const stat = statsMap.get(rec.section_id) ?? { total: 0, present: 0, todayDone: false };
    stat.total++;
    if (rec.present) stat.present++;
    if (rec.session_date === today) stat.todayDone = true;
    statsMap.set(rec.section_id, stat);
  }

  const todayRecords = (recentAttendance ?? []).filter((r) => r.session_date === today);
  const totalTodayPresent = todayRecords.filter((r) => r.present).length;
  const totalTodayAbsent = todayRecords.filter((r) => !r.present).length;
  const completedCount = [...statsMap.values()].filter((s) => s.todayDone).length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-3xl mb-2">✅</p>
          <h1 className="text-2xl lg:text-3xl font-bold">Présences</h1>
          <p className="text-sm opacity-80 mt-1">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="flex gap-4 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">{totalTodayPresent}</p>
              <p className="text-xs opacity-60">Présents</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">{totalTodayAbsent}</p>
              <p className="text-xs opacity-60">Absents</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">{completedCount}/{sections.length}</p>
              <p className="text-xs opacity-60">Fait</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes grid */}
      <div>
        <h2 className="font-bold text-navy text-lg mb-4">Sélectionnez une classe</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const stat = statsMap.get(section.id);
            const rate = stat && stat.total > 0
              ? Math.round((stat.present / stat.total) * 100)
              : null;
            const todayDone = stat?.todayDone ?? false;
            const levelName = (section.levels as unknown as { name: string } | null)?.name ?? "";

            return (
              <Link
                key={section.id}
                href={`/dashboard/professeur/classe/${section.id}`}
                className="block bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group relative overflow-hidden"
              >
                {todayDone && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      ✓ FAIT
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-md ${
                      todayDone
                        ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-500/20"
                        : "bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-blue-500/20"
                    }`}
                  >
                    {todayDone ? "✓" : levelName.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-navy text-sm">
                      {levelName} {section.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {section.seats_taken} / {section.capacity} élèves
                    </p>
                  </div>
                </div>

                {rate !== null ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Taux 30j</span>
                      <span
                        className={`text-sm font-bold ${
                          rate >= 90 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {rate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 text-center py-1">Aucune donnée</p>
                )}
              </Link>
            );
          })}

          {sections.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-slate-500 font-medium">Aucune classe assignée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
