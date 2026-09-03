import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

type WaitlistRow = {
  reservation_id: string;
  level_id: string;
  parent_full_name: string;
  parent_phone: string;
  waitlist_position: number;
  parent_trust_score: number | null;
  eta_days: number | null;
};

export default async function AdminWaitlistPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/admin/reservations/waitlist");
  if (!profile?.establishment_id) {
    return (
      <div className="card text-slate-600">
        Créez votre établissement pour accéder à la liste d&apos;attente.
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("waitlist_eta")
    .select("*")
    .eq("establishment_id", profile.establishment_id)
    .order("waitlist_position", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Liste d&apos;attente</h1>
        <Link href="/dashboard/admin/reservations" className="btn-secondary">
          ← Vue d&apos;ensemble
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <p className="text-sm text-slate-500 mb-4">
          La file d&apos;attente est triée par score de confiance (les parents
          fiables sont promus en premier), puis par ordre d&apos;arrivée. Les places
          libérées (expirations, annulations) déclenchent une promotion automatique.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Position</th>
              <th className="py-2">Parent</th>
              <th className="py-2">Téléphone</th>
              <th className="py-2">Score</th>
              <th className="py-2">ETA (jours)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: WaitlistRow) => (
              <tr key={r.reservation_id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">#{r.waitlist_position}</td>
                <td className="py-2">{r.parent_full_name}</td>
                <td className="py-2">{r.parent_phone}</td>
                <td className="py-2 tabular-nums">
                  {r.parent_trust_score !== null ? `${r.parent_trust_score}/100` : "—"}
                </td>
                <td className="py-2 tabular-nums">
                  {r.eta_days !== null ? `~${r.eta_days} j` : "indéterminé"}
                </td>
                <td className="py-2">
                  <form action={`/api/reservations/${r.reservation_id}/promote`} method="post">
                    <button type="submit" className="btn-primary text-xs">
                      Promouvoir
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={6} className="py-4 text-slate-400 text-center">
                  Personne en liste d&apos;attente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}