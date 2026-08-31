import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 0;

/**
 * v1 : affiche toutes les sections regroupées par niveau (de la 6ème à la
 * Terminale, ou tout autre niveau configuré). En production, ne montrer que
 * les sections affectées au professeur connecté via teacher_assignments.
 */
export default async function ProfesseurDashboardPage() {
  const supabase = await createClient();

  const { data: levels } = await supabase
    .from("levels")
    .select("id, name, rank, sections(id, name, capacity, seats_taken)")
    .order("rank");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Mes classes</h1>
      <p className="text-slate-500">
        Sélectionnez un niveau puis une section pour marquer les présences et saisir les notes.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {levels?.map((level) => {
          const sections = (level.sections ?? []) as { id: string; name: string }[];
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
        {(!levels || levels.length === 0) && (
          <div className="card text-slate-500 sm:col-span-2 lg:col-span-3">
            Aucun niveau configuré. Rendez-vous dans l&apos;espace administrateur pour créer les
            classes.
          </div>
        )}
      </div>
    </div>
  );
}
