import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // v1 : établissement démo — en production, dérivé du profil de l'utilisateur connecté (profiles.establishment_id)
  const { data: establishments } = await supabase.from("establishments").select("id, name").limit(1);
  const establishment = establishments?.[0];

  const { data: reservations } = await supabase
    .from("reservations")
    .select("status")
    .eq("establishment_id", establishment?.id ?? "");

  const { data: availability } = await supabase
    .from("level_availability")
    .select("*")
    .eq("establishment_id", establishment?.id ?? "");

  const counts = {
    reserved: reservations?.filter((r) => r.status === "reserved").length ?? 0,
    confirmed: reservations?.filter((r) => r.status === "confirmed").length ?? 0,
    pending: reservations?.filter((r) => r.status === "pending_payment").length ?? 0,
  };

  const totalCapacity = availability?.reduce((s, a) => s + a.total_capacity, 0) ?? 0;
  const totalTaken = availability?.reduce((s, a) => s + a.total_taken, 0) ?? 0;
  const fillRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">
          Espace administrateur {establishment ? `— ${establishment.name}` : ""}
        </h1>
        <Link href="/dashboard/admin/classes" className="btn-primary">
          Gérer les classes & quotas
        </Link>
      </div>

      {!establishment && (
        <div className="card text-slate-500">
          Aucun établissement trouvé. Créez-en un dans Supabase (table{" "}
          <code>establishments</code>) pour peupler ce tableau de bord.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Taux de remplissage</p>
          <p className="text-3xl font-bold text-navy">{fillRate}%</p>
          <p className="text-xs text-slate-400">{totalTaken} / {totalCapacity} places</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Réservations en attente de paiement</p>
          <p className="text-3xl font-bold text-amber-600">{counts.pending}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Réservées (à finaliser)</p>
          <p className="text-3xl font-bold text-brand">{counts.reserved}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Inscriptions finalisées</p>
          <p className="text-3xl font-bold text-emerald-600">{counts.confirmed}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-4">Disponibilité par niveau</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Niveau</th>
              <th className="py-2">Places prises</th>
              <th className="py-2">Capacité totale</th>
              <th className="py-2">Disponibles</th>
            </tr>
          </thead>
          <tbody>
            {availability?.map((lvl) => (
              <tr key={lvl.level_id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">{lvl.level_name}</td>
                <td className="py-2">{lvl.total_taken}</td>
                <td className="py-2">{lvl.total_capacity}</td>
                <td className="py-2">
                  {lvl.seats_available > 0 ? (
                    <span className="badge-success">{lvl.seats_available}</span>
                  ) : (
                    <span className="badge-danger">Complet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link href="/dashboard/secretariat" className="card hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-navy mb-1">🧾 Espace Secrétariat</h3>
          <p className="text-sm text-slate-500">Scanner les QR codes et finaliser les inscriptions.</p>
        </Link>
        <Link href="/dashboard/professeur" className="card hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-navy mb-1">🧑‍🏫 Espace Professeur</h3>
          <p className="text-sm text-slate-500">Présences, notes et suivi des classes.</p>
        </Link>
      </div>
    </div>
  );
}
