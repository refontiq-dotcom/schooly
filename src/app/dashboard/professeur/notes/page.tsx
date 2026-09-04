import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function NotesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur/notes");
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
        subject: a.subject,
        capacity: (a.sections as unknown as { capacity: number })?.capacity ?? 0,
        seats_taken: (a.sections as unknown as { seats_taken: number })?.seats_taken ?? 0,
        levels: (a.sections as unknown as { levels: { name: string } | null })?.levels ?? null,
      }));

  const sectionIds = sections.map((s) => s.id);

  const { data: recentGrades } = sectionIds.length > 0
    ? await supabase
        .from("grades")
        .select("section_id, score, max_score, evaluation_date, subject")
        .in("section_id", sectionIds)
        .order("evaluation_date", { ascending: false })
        .limit(500)
    : { data: null };

  const gradesBySection = new Map<string, { scores: number[]; count: number; subjects: Set<string> }>();
  for (const g of recentGrades ?? []) {
    const stat = gradesBySection.get(g.section_id) ?? { scores: [], count: 0, subjects: new Set() };
    stat.scores.push((Number(g.score) / Number(g.max_score)) * 20);
    stat.count++;
    stat.subjects.add(g.subject);
    gradesBySection.set(g.section_id, stat);
  }

  const globalAvg = recentGrades && recentGrades.length > 0
    ? recentGrades.reduce(
        (sum, g) => sum + (Number(g.score) / Number(g.max_score)) * 20,
        0
      ) / recentGrades.length
    : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-3xl mb-2">📝</p>
          <h1 className="text-2xl lg:text-3xl font-bold">Notes & Bulletins</h1>
          <p className="text-sm opacity-80 mt-1">
            Saisie et suivi des évaluations par classe
          </p>
          <div className="flex gap-4 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">{recentGrades?.length ?? 0}</p>
              <p className="text-xs opacity-60">Notes</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">
                {globalAvg !== null ? globalAvg.toFixed(1) : "—"}
              </p>
              <p className="text-xs opacity-60">Moyenne</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-xl font-bold">{sections.length}</p>
              <p className="text-xs opacity-60">Classes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes grid */}
      <div>
        <h2 className="font-bold text-navy text-lg mb-4">Sélectionnez une classe</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const stat = gradesBySection.get(section.id);
            const avg =
              stat && stat.scores.length > 0
                ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
                : null;
            const levelName = (section.levels as unknown as { name: string } | null)?.name ?? "";

            return (
              <Link
                key={section.id}
                href={`/dashboard/professeur/classe/${section.id}`}
                className="block bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-violet-300 transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-violet-500/20">
                    {levelName.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-navy text-sm">
                      {levelName} {section.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {stat?.count ?? 0} notes
                      {stat && stat.subjects.size > 0 && (
                        <span className="text-slate-300"> · {stat.subjects.size} matière(s)</span>
                      )}
                    </p>
                  </div>
                </div>

                {avg !== null ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Moyenne</span>
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          avg >= 14 ? "text-emerald-600" : avg >= 10 ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {avg.toFixed(1)}/20
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          avg >= 14 ? "bg-emerald-500" : avg >= 10 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, (avg / 20) * 100)}%` }}
                      />
                    </div>
                    {stat && stat.subjects.size > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {[...stat.subjects].slice(0, 3).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-medium">
                            {s}
                          </span>
                        ))}
                        {stat.subjects.size > 3 && (
                          <span className="text-[10px] text-slate-400">+{stat.subjects.size - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-slate-300">Pas encore de notes</p>
                  </div>
                )}
              </Link>
            );
          })}

          {sections.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-slate-500 font-medium">Aucune classe assignée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
