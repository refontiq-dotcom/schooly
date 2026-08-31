import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function SecretariatDashboardPage() {
  const supabase = await createClient();

  const { data: reservations } = await supabase
    .from("reservations")
    .select("*")
    .eq("status", "reserved")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Espace Secrétariat</h1>
        <Link href="/dashboard/secretariat/scan" className="btn-primary">
          📷 Scanner un QR code
        </Link>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-4">
          Réservations en attente de finalisation ({reservations?.length ?? 0})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Parent</th>
              <th className="py-2">Téléphone</th>
              <th className="py-2">Expire le</th>
            </tr>
          </thead>
          <tbody>
            {reservations?.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">{r.student_full_name}</td>
                <td className="py-2">{r.parent_full_name}</td>
                <td className="py-2">{r.parent_phone}</td>
                <td className="py-2 text-slate-500">
                  {r.expires_at ? new Date(r.expires_at).toLocaleString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
            {(!reservations || reservations.length === 0) && (
              <tr>
                <td colSpan={4} className="py-4 text-slate-400">
                  Aucune réservation en attente de finalisation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
