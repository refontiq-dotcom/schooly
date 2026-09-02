import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { PayFeeForm } from "../_forms";
import {
  FEE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import type { FeeStatus, PaymentMethod, PaymentStatus } from "@/types";

export const revalidate = 0;

export default async function ParentPaymentsPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/paiements");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("parent_id", user.id);
  const student = students?.[0];
  if (!student) {
    return <div className="card text-slate-500">Aucun enfant rattaché.</div>;
  }

  const [{ data: fees }, { data: categories }, { data: payments }] = await Promise.all([
    supabase.from("student_fees").select("*").eq("student_id", student.id).order("due_date"),
    supabase.from("fee_categories").select("id, name"),
    supabase.from("payments").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
  ]);

  const catName = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]));
  const remaining = (fees ?? []).reduce((s, f) => s + Number(f.amount) - Number(f.amount_paid), 0);
  const paid = (fees ?? []).reduce((s, f) => s + Number(f.amount_paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Paiements — {student.full_name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Mobile Money, échéanciers et historique clair des restes à payer.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Déjà versé</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatXof(paid)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reste à payer</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{formatXof(remaining)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {(fees ?? []).map((fee) => {
          const left = Math.max(0, Number(fee.amount) - Number(fee.amount_paid));
          return (
            <div key={fee.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-navy">{catName[fee.fee_category_id] ?? "Frais"}</h2>
                  <p className="text-sm text-slate-500">
                    {formatXof(Number(fee.amount_paid))} / {formatXof(Number(fee.amount))}
                    {fee.due_date ? ` · échéance ${new Date(fee.due_date).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </div>
                <span className={feeStatusClass(fee.status as FeeStatus)}>
                  {FEE_STATUS_LABEL[fee.status as FeeStatus]}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Number(fee.amount) > 0 ? Math.min(100, (Number(fee.amount_paid) / Number(fee.amount)) * 100) : 0}%` }}
                />
              </div>
              {left > 0 && <PayFeeForm feeId={fee.id} remaining={left} />}
            </div>
          );
        })}
        {(!fees || fees.length === 0) && (
          <div className="card text-slate-500">Aucun frais publié par l&apos;établissement.</div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Historique</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Date</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Moyen</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="py-2 tabular-nums">{formatXof(Number(p.amount))}</td>
                <td className="py-2">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</td>
                <td className="py-2">{PAYMENT_STATUS_LABEL[p.status as PaymentStatus]}</td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr><td colSpan={4} className="py-4 text-slate-400">Aucun paiement.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
