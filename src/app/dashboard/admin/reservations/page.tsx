import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { RESERVATION_STATUS_COLOR, RESERVATION_STATUS_LABEL } from "@/types";
import type { Reservation, ReservationStatus } from "@/types";

export const revalidate = 0;

type FunnelRow = {
  establishment_id: string;
  pending_payment_count: number;
  reserved_count: number;
  confirmed_count: number;
  expired_count: number;
  cancelled_count: number;
  waitlisted_count: number;
  rejected_fraud_count: number;
  total_count: number;
  confirmation_rate_pct: number;
  no_show_rate_pct: number;
};

export default async function AdminReservationsPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/admin/reservations");
  if (!profile?.establishment_id) {
    return (
      <div className="card text-slate-600">
        Créez votre établissement pour accéder au suivi des réservations.
      </div>
    );
  }

  const { data: funnel } = await supabase
    .from("reservation_conversion_funnel")
    .select("*")
    .eq("establishment_id", profile.establishment_id)
    .maybeSingle<FunnelRow>();

  const { data: recent } = await supabase
    .from("reservations")
    .select("*")
    .eq("establishment_id", profile.establishment_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const f = funnel ?? {
    pending_payment_count: 0,
    reserved_count: 0,
    confirmed_count: 0,
    expired_count: 0,
    cancelled_count: 0,
    waitlisted_count: 0,
    rejected_fraud_count: 0,
    total_count: 0,
    confirmation_rate_pct: 0,
    no_show_rate_pct: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Réservations</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/reservations/waitlist" className="btn-secondary">
            Liste d&apos;attente ({f.waitlisted_count})
          </Link>
          <Link href="/dashboard/admin/reservations/fraud" className="btn-secondary">
            Anti-fraude ({f.rejected_fraud_count})
          </Link>
        </div>
      </div>

      {/* Tunnel de conversion */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-4">Tunnel de conversion</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="En attente de paiement" value={f.pending_payment_count} color="text-amber-600" />
          <Stat label="Réservées" value={f.reserved_count} color="text-emerald-600" />
          <Stat label="Confirmées" value={f.confirmed_count} color="text-emerald-700" />
          <Stat label="Expirées (no-show)" value={f.expired_count} color="text-red-600" />
          <Stat label="Annulées" value={f.cancelled_count} color="text-slate-500" />
          <Stat label="Liste d'attente" value={f.waitlisted_count} color="text-blue-600" />
          <Stat label="Rejetées (fraude)" value={f.rejected_fraud_count} color="text-red-700" />
          <Stat label="Total" value={f.total_count} color="text-navy" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <div className="text-xs text-slate-500">Taux de confirmation</div>
            <div className="text-2xl font-bold text-emerald-700">
              {f.confirmation_rate_pct}%
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs text-slate-500">Taux de no-show</div>
            <div className="text-2xl font-bold text-amber-700">{f.no_show_rate_pct}%</div>
          </div>
        </div>
      </div>

      {/* Réservations récentes */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Dernières réservations</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Parent</th>
              <th className="py-2">Téléphone</th>
              <th className="py-2">Score</th>
              <th className="py-2">Statut</th>
              <th className="py-2">Créée le</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r: Reservation) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 font-medium">{r.student_full_name}</td>
                <td className="py-2">{r.parent_full_name}</td>
                <td className="py-2">{r.parent_phone}</td>
                <td className="py-2 tabular-nums">
                  {r.parent_trust_score !== null ? `${r.parent_trust_score}/100` : "—"}
                </td>
                <td className="py-2">
                  <span className={RESERVATION_STATUS_COLOR[r.status as ReservationStatus]}>
                    {RESERVATION_STATUS_LABEL[r.status as ReservationStatus]}
                  </span>
                </td>
                <td className="py-2 text-slate-500">
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
            {(!recent || recent.length === 0) && (
              <tr>
                <td colSpan={6} className="py-4 text-slate-400 text-center">
                  Aucune réservation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}