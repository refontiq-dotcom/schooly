import { createClient } from "@/lib/supabase/server";
import type { Establishment, LevelAvailability } from "@/types";
import { notFound } from "next/navigation";
import ReservationForm from "./reservation-form";

export const revalidate = 0;

async function getEstablishment(id: string) {
  const supabase = await createClient();

  const { data: establishment } = await supabase
    .from("establishments")
    .select("*")
    .eq("id", id)
    .single() as { data: Establishment | null };

  const { data: availability } = await supabase
    .from("level_availability")
    .select("*")
    .eq("establishment_id", id)
    .order("level_name") as { data: LevelAvailability[] | null };

  return { establishment, availability: availability ?? [] };
}

export default async function EstablishmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { establishment, availability } = await getEstablishment(id);

  if (!establishment) return notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-56 rounded-xl bg-gradient-to-br from-brand to-navy flex items-center justify-center text-white text-2xl font-semibold">
          {establishment.name}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-navy">{establishment.name}</h1>
          <p className="text-slate-500">{establishment.city} — {establishment.address}</p>
        </div>

        {establishment.description && (
          <p className="text-slate-700 leading-relaxed">{establishment.description}</p>
        )}

        <div className="flex flex-wrap gap-3">
          {establishment.tour_360_url && (
            <a
              href={establishment.tour_360_url}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              🧭 Visite virtuelle 360°
            </a>
          )}
          {establishment.latitude && establishment.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.latitude},${establishment.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              📍 Itinéraire
            </a>
          )}
          {establishment.website_url && (
            <a
              href={establishment.website_url}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              🔗 Site web de l&apos;établissement
            </a>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-4">Places disponibles par niveau</h2>
          <div className="space-y-2">
            {availability.map((lvl) => (
              <div
                key={lvl.level_id}
                className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"
              >
                <span className="text-slate-700">{lvl.level_name}</span>
                {lvl.seats_available > 0 ? (
                  <span className="badge-success">
                    {lvl.seats_available} / {lvl.total_capacity} places
                  </span>
                ) : (
                  <span className="badge-danger">Complet</span>
                )}
              </div>
            ))}
            {availability.length === 0 && (
              <p className="text-sm text-slate-500">
                Aucune classe configurée pour le moment.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="card sticky top-6">
          <h2 className="font-semibold text-navy mb-1">Réserver une place</h2>
          <p className="text-sm text-slate-500 mb-4">
            Frais de réservation :{" "}
            <strong>
              {establishment.reservation_fee_amount.toLocaleString("fr-FR")} FCFA
            </strong>{" "}
            — non inclus dans les frais de scolarité.
          </p>
          <ReservationForm establishmentId={establishment.id} levels={availability} />
        </div>
      </div>
    </div>
  );
}
