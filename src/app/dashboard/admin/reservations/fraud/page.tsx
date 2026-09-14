import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

type AtRiskRow = {
  parent_phone: string;
  parent_email: string | null;
  trust_score: number;
  confirmed: number;
  expired: number;
  cancelled: number;
  pending: number;
  fraud_rejected: number;
  risk_level: "high" | "medium" | "low";
};

const RISK_LABEL = { high: "Élevé", medium: "Moyen", low: "Faible" } as const;
const RISK_COLOR = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
} as const;

export default async function AdminFraudPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/admin/reservations/fraud");
  if (!profile?.establishment_id) {
    return (
      <div className="card text-slate-600">
        Créez votre établissement pour accéder à l&apos;anti-fraude.
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("at_risk_parents")
    .select("*")
    .eq("establishment_id", profile.establishment_id)
    .order("trust_score", { ascending: true });

  const { data: recent } = await supabase
    .from("reservations")
    .select("id, student_full_name, parent_full_name, parent_phone, fraud_flags, status, created_at")
    .eq("establishment_id", profile.establishment_id)
    .eq("status", "rejected_fraud")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Anti-fraude</h1>
        <Link href="/dashboard/admin/reservations" className="btn-secondary">
          ← Vue d&apos;ensemble
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-2">Parents à risque</h2>
        <p className="text-sm text-slate-500 mb-4">
          Score de confiance agrégé par téléphone. Un score inférieur à 40 signifie
          que l&apos;historique du parent comporte beaucoup plus d&apos;échecs (no-show,
          annulation) que de confirmations.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Téléphone</th>
              <th className="py-2">Email</th>
              <th className="py-2">Score</th>
              <th className="py-2">Confirmées</th>
              <th className="py-2">Expirées</th>
              <th className="py-2">Annulées</th>
              <th className="py-2">Fraude</th>
              <th className="py-2">Risque</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: AtRiskRow) => (
              <tr key={r.parent_phone} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-mono text-xs">{r.parent_phone}</td>
                <td className="py-2 text-xs">{r.parent_email ?? "—"}</td>
                <td className="py-2 tabular-nums font-bold">{r.trust_score}/100</td>
                <td className="py-2 tabular-nums">{r.confirmed}</td>
                <td className="py-2 tabular-nums">{r.expired}</td>
                <td className="py-2 tabular-nums">{r.cancelled}</td>
                <td className="py-2 tabular-nums">{r.fraud_rejected}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${RISK_COLOR[r.risk_level]}`}>
                    {RISK_LABEL[r.risk_level]}
                  </span>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={8} className="py-4 text-slate-400 text-center">
                  Aucun parent à risque pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-2">Réservations rejetées pour fraude</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Parent</th>
              <th className="py-2">Téléphone</th>
              <th className="py-2">Flags</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">{r.student_full_name}</td>
                <td className="py-2">{r.parent_full_name}</td>
                <td className="py-2 font-mono text-xs">{r.parent_phone}</td>
                <td className="py-2 text-xs">
                  {(r.fraud_flags ?? []).map((f: string) => (
                    <span key={f} className="inline-block mr-1 px-2 py-0.5 rounded bg-red-50 text-red-700">
                      {f}
                    </span>
                  ))}
                </td>
                <td className="py-2 text-slate-500">
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
            {(!recent || recent.length === 0) && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-400 text-center">
                  Aucune réservation rejetée pour fraude.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}