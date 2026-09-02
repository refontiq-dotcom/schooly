import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { ConfirmPaymentButton, FeeCategoryForm } from "../_ops-forms";
import {
  FEE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import type { FeeStatus, PaymentMethod, PaymentStatus } from "@/types";

export const revalidate = 0;

export default async function AdminPaiementsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile || !supabase) redirect("/auth?returnTo=/dashboard/admin/paiements");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const etab = profile.establishment_id;
  const [{ data: categories }, { data: fees }, { data: payments }, { data: students }] = await Promise.all([
    supabase.from("fee_categories").select("*").eq("establishment_id", etab).order("created_at", { ascending: false }),
    supabase.from("student_fees").select("*").eq("establishment_id", etab),
    supabase.from("payments").select("*").eq("establishment_id", etab).order("created_at", { ascending: false }).limit(30),
    supabase.from("students").select("id, full_name").eq("establishment_id", etab),
  ]);

  const names = Object.fromEntries((students ?? []).map((s) => [s.id, s.full_name]));
  const expected = (fees ?? []).reduce((s, f) => s + Number(f.amount), 0);
  const collected = (fees ?? []).reduce((s, f) => s + Number(f.amount_paid), 0);
  const overdue = (fees ?? []).filter((f) => f.status === "overdue").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Paiements & impayés</h1>
        <p className="text-sm text-slate-500 mt-1">
          Transparence des frais, Mobile Money et rappels d&apos;échéances.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Attendu</p>
          <p className="text-2xl font-bold tabular-nums">{formatXof(expected)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Encaissé</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatXof(collected)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Échéances en retard</p>
          <p className="text-2xl font-bold text-red-700 tabular-nums">{overdue}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Publier un frais</h2>
        <FeeCategoryForm />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Catalogue</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Nom</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Échéance</th>
            </tr>
          </thead>
          <tbody>
            {(categories ?? []).map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2">{c.name}</td>
                <td className="py-2 tabular-nums">{formatXof(Number(c.amount))}</td>
                <td className="py-2">{c.due_date ? new Date(c.due_date).toLocaleDateString("fr-FR") : "—"}</td>
              </tr>
            ))}
            {(!categories || categories.length === 0) && (
              <tr><td colSpan={3} className="py-4 text-slate-400">Aucun frais.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Paiements à confirmer</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Élève</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Moyen</th>
              <th className="py-2">Statut</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-2">{names[p.student_id] ?? "—"}</td>
                <td className="py-2 tabular-nums">{formatXof(Number(p.amount))}</td>
                <td className="py-2">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</td>
                <td className="py-2">{PAYMENT_STATUS_LABEL[p.status as PaymentStatus]}</td>
                <td className="py-2">
                  {p.status === "pending" ? <ConfirmPaymentButton id={p.id} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Suivi par élève</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Élève</th>
              <th className="py-2">Statut</th>
              <th className="py-2">Reste</th>
            </tr>
          </thead>
          <tbody>
            {(fees ?? []).slice(0, 40).map((f) => (
              <tr key={f.id} className="border-b border-slate-100">
                <td className="py-2">{names[f.student_id] ?? "—"}</td>
                <td className="py-2">
                  <span className={feeStatusClass(f.status as FeeStatus)}>{FEE_STATUS_LABEL[f.status as FeeStatus]}</span>
                </td>
                <td className="py-2 tabular-nums">{formatXof(Number(f.amount) - Number(f.amount_paid))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
