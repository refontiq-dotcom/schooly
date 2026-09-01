import AddLevelForm from "./add-level-form";
import AddSectionForm from "./add-section-form";
import { getSessionProfile } from "@/lib/auth/session";
import Link from "next/link";

export const revalidate = 0;

export default async function AdminClassesPage() {
  const { supabase, profile } = await getSessionProfile();

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: levels } = await supabase
    .from("levels")
    .select("*, sections(*)")
    .eq("establishment_id", establishment?.id ?? "")
    .order("rank");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-navy">
        Classes & quotas {establishment ? `— ${establishment.name}` : ""}
      </h1>

      {!establishment && (
        <div className="card text-slate-500">
          Aucun établissement rattaché.{" "}
          <Link href="/onboarding/etablissement" className="text-amber-600 hover:underline">
            Créer un établissement
          </Link>
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
          const sections = level.sections as { id: string; name: string; capacity: number; seats_taken: number }[];
          const totalCapacity = sections.reduce((s, sec) => s + sec.capacity, 0);
          const totalTaken = sections.reduce((s, sec) => s + sec.seats_taken, 0);

          return (
            <div key={level.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg text-navy">{level.name}</h3>
                <span className="text-sm text-slate-500">
                  {totalTaken} / {totalCapacity} places ({sections.length} section{sections.length > 1 ? "s" : ""})
                </span>
              </div>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2">Section</th>
                    <th className="py-2">Capacité</th>
                    <th className="py-2">Places prises</th>
                    <th className="py-2">Disponibles</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <tr key={sec.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 font-medium">{sec.name}</td>
                      <td className="py-2">{sec.capacity}</td>
                      <td className="py-2">{sec.seats_taken}</td>
                      <td className="py-2">{sec.capacity - sec.seats_taken}</td>
                    </tr>
                  ))}
                  {sections.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-slate-400">
                        Aucune section pour ce niveau.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <AddSectionForm levelId={level.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
