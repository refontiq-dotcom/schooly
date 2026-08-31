import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Establishment, LevelAvailability } from "@/types";

export const revalidate = 0;

async function getEstablishments() {
  const supabase = await createClient();

  const { data: establishments } = await supabase
    .from("establishments")
    .select("*")
    .order("name") as { data: Establishment[] | null };

  const { data: availability } = await supabase
    .from("level_availability")
    .select("*") as { data: LevelAvailability[] | null };

  return { establishments: establishments ?? [], availability: availability ?? [] };
}

export default async function HomePage() {
  const { establishments, availability } = await getEstablishments();

  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-navy mb-2">
          Trouvez une place scolaire pour votre enfant
        </h1>
        <p className="text-slate-600 max-w-2xl">
          Consultez les places disponibles en temps réel, visitez virtuellement
          l&apos;établissement et réservez en ligne en quelques minutes.
        </p>
      </section>

      {establishments.length === 0 && (
        <div className="card text-slate-500">
          Aucun établissement n&apos;est encore référencé. Connectez votre base
          Supabase et ajoutez un établissement depuis l&apos;espace administrateur
          (<code>/dashboard/admin</code>) pour voir apparaître des résultats ici.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {establishments.map((etab) => {
          const levels = availability.filter((a) => a.establishment_id === etab.id);
          const totalAvailable = levels.reduce((sum, l) => sum + l.seats_available, 0);

          return (
            <Link
              key={etab.id}
              href={`/etablissement/${etab.id}`}
              className="card hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="h-32 rounded-lg bg-gradient-to-br from-brand to-navy mb-4 flex items-center justify-center text-white font-semibold">
                {etab.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={etab.cover_image_url}
                    alt={etab.name}
                    className="h-full w-full object-cover rounded-lg"
                  />
                ) : (
                  etab.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <h2 className="font-semibold text-slate-900">{etab.name}</h2>
              <p className="text-sm text-slate-500 mb-3">{etab.city}</p>
              <div className="mt-auto">
                {totalAvailable > 0 ? (
                  <span className="badge-success">
                    {totalAvailable} place{totalAvailable > 1 ? "s" : ""} disponible
                    {totalAvailable > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="badge-danger">Complet</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
