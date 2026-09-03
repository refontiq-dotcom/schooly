import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { ConfirmPaymentButton } from "@/app/dashboard/admin/_ops-forms";
import { formatXof, PAYMENT_METHOD_LABEL } from "@/lib/operations/labels";
import type { PaymentMethod } from "@/types";
import {
  fetchSecretariatDailyActions,
  fetchStudentsMissingDocuments,
  fetchPendingQRFinalizations,
  fetchSecretariatRecentActions,
  completenessLabel,
  completenessColor,
  isWorkloadCritical,
} from "@/lib/secretariat-intelligence/scoring";

export const revalidate = 0;

export default async function SecretariatDashboardPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/secretariat");
  }

  const estId = profile?.establishment_id;

  const [reservationsRes, paymentsRes, daily, missingDocs, pendingQR, recentActions] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .eq("status", "reserved")
      .order("created_at", { ascending: false })
      .eq("establishment_id", estId ?? ""),
    supabase
      .from("payments")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20)
      .eq("establishment_id", estId ?? ""),
    estId ? fetchSecretariatDailyActions(supabase, estId) : Promise.resolve(null),
    estId ? fetchStudentsMissingDocuments(supabase, estId, 10) : Promise.resolve([]),
    estId ? fetchPendingQRFinalizations(supabase, estId, 10) : Promise.resolve([]),
    estId ? fetchSecretariatRecentActions(supabase, estId, 8) : Promise.resolve([]),
  ]);

  const reservations = reservationsRes.data;
  const pendingPayments = paymentsRes.data;

  const studentIds = [...new Set((pendingPayments ?? []).map((p) => p.student_id))];
  const { data: payStudents } = studentIds.length
    ? await supabase.from("students").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const studentNames = Object.fromEntries((payStudents ?? []).map((s) => [s.id, s.full_name]));

  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Espace Secrétariat</h1>
        <Link href="/dashboard/secretariat/scan" className="btn-primary">
          📷 Scanner un QR code
        </Link>
      </div>

      {/* Bandeau intelligence : actions du jour */}
      {daily && (
        <>
          {isWorkloadCritical(daily) && (
            <div className="card border-red-200 bg-red-50">
              <p className="text-sm font-semibold text-red-800">
                🚨 Charge élevée : {daily.total_pending_actions} action(s) en attente aujourd&apos;hui
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiMini
              label="Réservations aujourd'hui"
              value={daily.reservations_today}
              sub={`${daily.pending_payment_count} en attente de paiement`}
            />
            <KpiMini
              label="À scanner"
              value={daily.reserved_count}
              sub="QR code à flasher"
            />
            <KpiMini
              label="Paiements en attente"
              value={daily.payments_pending}
              sub={`${formatXof(Number(daily.pending_amount))} à confirmer`}
              color={daily.payments_pending > 0 ? "amber" : "slate"}
            />
            <KpiMini
              label="Dossiers incomplets"
              value={daily.students_with_incomplete_docs}
              sub="docs manquants à relancer"
              color={daily.students_with_incomplete_docs > 0 ? "red" : "slate"}
            />
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Réservations à finaliser */}
        <div className="card">
          <h2 className="font-semibold text-navy mb-4">
            Réservations à finaliser ({reservations?.length ?? 0})
          </h2>
          {reservations && reservations.length > 0 ? (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {reservations.slice(0, 10).map((r) => (
                <li key={r.id} className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <p className="text-sm font-medium text-navy">{r.student_full_name}</p>
                  <p className="text-xs text-slate-500">
                    {r.parent_full_name} · {r.parent_phone}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Expire : {r.expires_at ? new Date(r.expires_at).toLocaleString("fr-FR") : "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aucune réservation en attente.
            </p>
          )}
        </div>

        {/* QR codes en attente */}
        <div className="card">
          <h2 className="font-semibold text-navy mb-4">
            QR codes en attente ({pendingQR.length})
          </h2>
          {pendingQR.length > 0 ? (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {pendingQR.map((qr) => (
                <li key={qr.reservation_id} className="p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{qr.student_full_name}</p>
                      <p className="text-xs text-slate-500">{qr.parent_phone}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                        qr.finalization_state === "expired"
                          ? "bg-red-100 text-red-700"
                          : qr.finalization_state === "awaiting_payment"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {qr.finalization_state === "expired"
                        ? "Expiré"
                        : qr.finalization_state === "awaiting_payment"
                        ? "Attente paiement"
                        : "À scanner"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aucun QR code en attente.
            </p>
          )}
        </div>
      </div>

      {/* Dossiers incomplets */}
      {missingDocs.length > 0 && (
        <div className="card border-amber-200">
          <h2 className="font-semibold text-navy mb-4">
            📋 Dossiers incomplets ({missingDocs.length})
          </h2>
          <div className="space-y-2">
            {missingDocs.slice(0, 8).map((d) => (
              <div
                key={d.student_id}
                className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{d.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {d.section_name ?? "—"} · {d.required_validated}/{d.required_total} validé(s) · {d.required_missing} manquant(s)
                  </p>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs font-semibold text-slate-700">{d.completeness_pct}%</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${colorMap[completenessColor(d.status)]}`}>
                    {completenessLabel(d.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Paiements Mobile Money à confirmer</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Élève</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Moyen</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(pendingPayments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{studentNames[p.student_id] ?? "—"}</td>
                <td className="py-2 tabular-nums">{formatXof(Number(p.amount))}</td>
                <td className="py-2">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</td>
                <td className="py-2"><ConfirmPaymentButton id={p.id} /></td>
              </tr>
            ))}
            {(!pendingPayments || pendingPayments.length === 0) && (
              <tr>
                <td colSpan={4} className="py-4 text-slate-400">Aucun paiement en attente.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Historique actions récentes */}
      {recentActions.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-4">📜 Activité récente</h2>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {recentActions.map((a) => (
              <li key={`${a.action_type}-${a.id}`} className="text-sm flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-slate-800 truncate">
                    {a.action_type === "reservation_finalized" ? "✅" : "💰"}{" "}
                    <span className="font-medium">{a.target_name}</span>{" "}
                    <span className="text-slate-500">
                      — {a.action_type === "reservation_finalized" ? "réservation finalisée" : "paiement confirmé"}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {a.action_at ? new Date(a.action_at).toLocaleString("fr-FR") : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KpiMini({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string | number;
  sub: string;
  color?: "slate" | "red" | "amber" | "green";
}) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-700",
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
  };
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
