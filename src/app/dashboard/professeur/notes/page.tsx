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
    ? allSections ?? []
    : (assignments ?? []).map((a) => ({
        id: a.section_id,
        name: (a.sections as unknown as { name: string })?.name ?? "",
        subject: a.subject,
        capacity: (a.sections as unknown as { capacity: number })?.capacity ?? 0,
        seats_taken: (a.sections as unknown as { seats_taken: number })?.seats_taken ?? 0,
        levels: (a.sections as unknown as { levels: { name: string } | null })?.levels ?? null,
      }));

  const sectionIds = sections.map((s) => s.id);

  // Récupérer les stats de notes par section
  const { data: recentGrades } = sectionIds.length > 0
    ? await supabase
        .from("grades")
        .select("section_id, score, max_score, evaluation_date, subject")
        .in("section_id", sectionIds)
        .order("evaluation_date", { ascending: false })
        .limit(500)
    : { data: null };

  // Stats par section
  const gradesBySection = new Map<string, { scores: number[]; count: number; subjects: Set<string> }>();
  for (const g of recentGrades ?? []) {
    const stat = gradesBySection.get(g.section_id) ?? { scores: [], count: 0, subjects: new Set() };
    stat.scores.push((Number(g.score) / Number(g.max_score)) * 20);
    stat.count++;
    stat.subjects.add(g.subject);
    gradesBySection.set(g.section_id, stat);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">📝 Notes & Bulletins</h1>
        <p className="text-sm text-slate-500 mt-1">
          Saisie et suivi des évaluations par classe
        </p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <p className="text-3xl mb-1">📝</p>
          <p className="text-2xl font-bold text-blue-700">{recentGrades?.length ?? 0}</p>
          <p className="text-xs text-blue-600">Notes cette période</p>
        </div>
        <div className="card bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
          <p className="text-3xl mb-1">📊</p>
          <p className="text-2xl font-bold text-violet-700">
            {recentGrades && recentGrades.length > 0
              ? (
                  recentGrades.reduce(
                    (sum, g) => sum + (Number(g.score) / Number(g.max_score)) * 20,
                    0
                  ) / recentGrades.length
                ).toFixed(1)
              : "—"}
          </p>
          <p className="text-xs text-violet-600">Moyenne générale</p>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <p className="text-3xl mb-1">🏫</p>
          <p className="text-2xl font-bold text-emerald-700">{sections.length}</p>
          <p className="text-xs text-emerald-600">Classes</p>
        </div>
      </div>

      {/* Liste des classes */}
      <div className="space-y-3">
        <h2 className="font-semibold text-navy text-sm uppercase tracking-wide">
          Choisir une classe
        </h2>
        {sections.map((section) => {
          const stat = gradesBySection.get(section.id);
          const avg =
            stat && stat.scores.length > 0
              ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
              : null;

          return (
            <Link
              key={section.id}
              href={`/dashboard/professeur/classe/${section.id}`}
              className="block p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-lg font-bold">
                    📝
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-sm">
                      {(section.levels as unknown as { name: string } | null)?.name ?? ""}{" "}
                      {section.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {stat?.count ?? 0} notes
                      {stat && stat.subjects.size > 0 && ` · ${[...stat.subjects].join(", ")}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {avg !== null ? (
                    <div>
                      <p
                        className={`text-lg font-bold ${
                          avg >= 14
                            ? "text-emerald-600"
                            : avg >= 10
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {avg.toFixed(1)}/20
                      </p>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${
                            avg >= 14
                              ? "bg-emerald-500"
                              : avg >= 10
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, (avg / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">Pas encore de notes</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {sections.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-3">📝</p>
            <p>Aucune classe assignée.</p>
          </div>
        )}
      </div>
    </div>
  );
}
