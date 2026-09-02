import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { ConfirmPaymentButton } from "@/app/dashboard/admin/_ops-forms";
import { formatXof, PAYMENT_METHOD_LABEL } from "@/lib/operations/labels";
import type { PaymentMethod } from "@/types";

export const revalidate = 0;

export default async function SecretariatDashboardPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/secretariat");
  }

  let query = supabase
    .from("reservations")
    .select("*")
    .eq("status", "reserved")
    .order("created_at", { ascending: false });

  if (profile?.establishment_id) {
    query = query.eq("establishment_id", profile.establishment_id);
  }

  const { data: reservations } = await query;

  const pendingPayQuery = supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: pendingPayments } = profile?.establishment_id
    ? await pendingPayQuery.eq("establishment_id", profile.establishment_id)
    : await pendingPayQuery;

  const studentIds = [...new Set((pendingPayments ?? []).map((p) => p.student_id))];
  const { data: payStudents } = studentIds.length
    ? await supabase.from("students").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const studentNames = Object.fromEntries((payStudents ?? []).map((s) => [s.id, s.full_name]));

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
    </div>
  );
}
