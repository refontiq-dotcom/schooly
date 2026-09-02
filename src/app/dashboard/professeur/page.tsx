import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function ProfesseurDashboardPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/professeur");
  }

  const assignedSectionIds =
    profile?.role === "admin"
      ? null
      : (
          await supabase
            .from("teacher_assignments")
            .select("section_id")
            .eq("teacher_id", profile?.id ?? "")
        ).data?.map((a) => a.section_id) ?? [];

  let levelsQuery = supabase
    .from("levels")
    .select("id, name, rank, sections(id, name, capacity, seats_taken)")
    .order("rank");

  if (profile?.establishment_id) {
    levelsQuery = levelsQuery.eq("establishment_id", profile.establishment_id);
  }

  const { data: levels } = await levelsQuery;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Mes classes</h1>
      <p className="text-slate-500">
        Sélectionnez un niveau puis une section pour marquer les présences et saisir les notes.
      </p>

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
                {sections.map((sec) => (
                  <Link
                    key={sec.id}
                    href={`/dashboard/professeur/classe/${sec.id}`}
                    className="btn-secondary text-sm"
                  >
                    {sec.name}
                  </Link>
                ))}
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
