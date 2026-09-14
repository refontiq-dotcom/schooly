import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import {
  ConfirmPaymentButton,
  FeeCategoryForm,
} from "../_ops-forms";
import {
  FEE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import {
  RISK_LEVEL_LABEL,
  riskLevel,
} from "@/lib/payment-intelligence/scoring";
import type { FeeStatus, PaymentMethod, PaymentStatus } from "@/types";

export const revalidate = 0;

type Overview = {
  establishment_id: string;
  total_collected: number;
  total_pending: number;
  total_remaining: number;
  recovery_rate_pct: number;
  confirmed_count: number;
  pending_count: number;
  failed_count: number;
  overdue_count: number;
  partial_count: number;
  orange_money_total: number;
  mtn_momo_total: number;
  wave_total: number;
  moov_total: number;
  cash_total: number;
  bank_total: number;
};

type Monthly = {
  establishment_id: string;
  month: string;
  confirmed_total: number;
  pending_total: number;
  failed_total: number;
  confirmed_count: number;
};

type Overdue = {
  id: string;
  student_id: string;
  student_name: string;
  parent_phone: string;
  fee_category: string;
  amount: number;
  amount_paid: number;
  remaining: number;
  due_date: string;
  days_late: number;
  late_days: number;
  payment_risk_score: number | null;
};

type Anomaly = {
  id: string;
  student_id: string;
  student_name: string;
  parent_phone: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  anomaly_flags: string[];
  created_at: string;
};

type HighRisk = {
  id: string;
  student_id: string;
  student_name: string;
  parent_phone: string;
  amount: number;
  method: string;
  payment_risk_score: number;
  created_at: string;
};

export default async function AdminPaiementsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile || !supabase) redirect("/auth?returnTo=/dashboard/admin/paiements");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const etab = profile.establishment_id;

  const [
    { data: overview },
    { data: monthly },
    { data: overdue },
    { data: anomalies },
    { data: highRisk },
    { data: categories },
    { data: payments },
    { data: students },
  ] = await Promise.all([
    supabase.from("payment_overview").select("*").eq("establishment_id", etab).maybeSingle<Overview>(),
    supabase.from("monthly_revenue").select("*").eq("establishment_id", etab).limit(12),
    supabase.from("overdue_fees").select("*").eq("establishment_id", etab).limit(20),
    supabase.from("payment_anomalies").select("*").eq("establishment_id", etab).limit(20),
    supabase.from("high_risk_payments").select("*").eq("establishment_id", etab).limit(20),
    supabase.from("fee_categories").select("*").eq("establishment_id", etab).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("establishment_id", etab).order("created_at", { ascending: false }).limit(15),
    supabase.from("students").select("id, full_name").eq("establishment_id", etab),
  ]);

  const names = Object.fromEntries((students ?? []).map((s) => [s.id, s.full_name]));

  const o = overview ?? {
    total_collected: 0,
    total_pending: 0,
    total_remaining: 0,
    recovery_rate_pct: 0,
    confirmed_count: 0,
    pending_count: 0,
    failed_count: 0,
    overdue_count: 0,
    partial_count: 0,
    orange_money_total: 0,
    mtn_momo_total: 0,
    wave_total: 0,
    moov_total: 0,
    cash_total: 0,
    bank_total: 0,
  };

  const totalMethod =
    o.orange_money_total + o.mtn_momo_total + o.wave_total + o.moov_total + o.cash_total + o.bank_total;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Paiements & trésorerie</h1>
        <p className="text-sm text-slate-500 mt-1">
          Vue d&apos;ensemble intelligente : recouvrement, retards, risques, anomalies.
        </p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Encaissé"
          value={formatXof(o.total_collected)}
          color="text-emerald-700"
          hint={`${o.confirmed_count} paiement(s) confirmé(s)`}
        />
        <Kpi
          label="En attente"
          value={formatXof(o.total_pending)}
          color="text-amber-600"
          hint={`${o.pending_count} paiement(s) à confirmer`}
        />
        <Kpi
          label="Restant dû"
          value={formatXof(o.total_remaining)}
          color="text-red-700"
          hint={`${o.overdue_count} échéances en retard`}
        />
        <Kpi
          label="Taux de recouvrement"
          value={`${o.recovery_rate_pct}%`}
          color={o.recovery_rate_pct >= 80 ? "text-emerald-700" : o.recovery_rate_pct >= 50 ? "text-amber-700" : "text-red-700"}
          hint={`${o.failed_count} échec(s) de paiement`}
        />
      </div>

      {/* Répartition par méthode */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Répartition par moyen de paiement</h2>
        <div className="space-y-2">
          <MethodBar
            label="Orange Money"
            value={o.orange_money_total}
            total={totalMethod}
            color="bg-orange-500"
          />
          <MethodBar
            label="MTN MoMo"
            value={o.mtn_momo_total}
            total={totalMethod}
            color="bg-yellow-500"
          />
          <MethodBar
            label="Wave"
            value={o.wave_total}
            total={totalMethod}
            color="bg-blue-500"
          />
          <MethodBar
            label="Moov"
            value={o.moov_total}
            total={totalMethod}
            color="bg-purple-500"
          />
          <MethodBar
            label="Espèces"
            value={o.cash_total}
            total={totalMethod}
            color="bg-emerald-500"
          />
          <MethodBar
            label="Virement"
            value={o.bank_total}
            total={totalMethod}
            color="bg-slate-500"
          />
        </div>
      </div>

      {/* Échéances en retard + risques */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-navy mb-3">
            🔴 Échéances en retard ({(overdue ?? []).length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Élève</th>
                <th className="py-2">Frais</th>
                <th className="py-2">Retard</th>
                <th className="py-2">Reste</th>
              </tr>
            </thead>
            <tbody>
              {(overdue ?? []).map((row: Overdue) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{row.student_name}</td>
                  <td className="py-2 text-slate-600">{row.fee_category}</td>
                  <td className="py-2 tabular-nums text-red-700 font-semibold">
                    {row.days_late} j
                  </td>
                  <td className="py-2 tabular-nums">{formatXof(Number(row.remaining))}</td>
                </tr>
              ))}
              {(!overdue || overdue.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-400 text-center">
                    Aucun retard. Bravo !
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-navy mb-3">
            ⚠️ Paiements à haut risque ({(highRisk ?? []).length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Élève</th>
                <th className="py-2">Montant</th>
                <th className="py-2">Méthode</th>
                <th className="py-2">Risque</th>
              </tr>
            </thead>
            <tbody>
              {(highRisk ?? []).map((row: HighRisk) => {
                const level = riskLevel(row.payment_risk_score);
                const meta = RISK_LEVEL_LABEL[level];
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{row.student_name}</td>
                    <td className="py-2 tabular-nums">{formatXof(Number(row.amount))}</td>
                    <td className="py-2">{PAYMENT_METHOD_LABEL[row.method as PaymentMethod]}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${meta.color}`}>
                        {meta.label} ({row.payment_risk_score})
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!highRisk || highRisk.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-400 text-center">
                    Aucun paiement à haut risque.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies */}
      {(anomalies ?? []).length > 0 && (
        <div className="card overflow-x-auto border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-800 mb-3">
            🚨 Anomalies détectées ({(anomalies ?? []).length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-amber-700 border-b border-amber-200">
                <th className="py-2">Élève</th>
                <th className="py-2">Montant</th>
                <th className="py-2">Référence</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {(anomalies ?? []).map((row: Anomaly) => (
                <tr key={row.id} className="border-b border-amber-100">
                  <td className="py-2 font-medium">{row.student_name}</td>
                  <td className="py-2 tabular-nums">{formatXof(Number(row.amount))}</td>
                  <td className="py-2 font-mono text-xs">{row.reference ?? "—"}</td>
                  <td className="py-2 text-xs">
                    {row.anomaly_flags.map((f) => (
                      <span
                        key={f}
                        className="inline-block mr-1 px-2 py-0.5 rounded bg-red-100 text-red-700"
                      >
                        {f}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Catalogue */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Publier un frais</h2>
        <FeeCategoryForm />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Catalogue de frais</h2>
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
                <td className="py-2">
                  {c.due_date ? new Date(c.due_date).toLocaleDateString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
            {(!categories || categories.length === 0) && (
              <tr>
                <td colSpan={3} className="py-4 text-slate-400">
                  Aucun frais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paiements récents */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-4">Derniers paiements</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Élève</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Moyen</th>
              <th className="py-2">Statut</th>
              <th className="py-2">Risque</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-2">{names[p.student_id] ?? "—"}</td>
                <td className="py-2 tabular-nums">{formatXof(Number(p.amount))}</td>
                <td className="py-2">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</td>
                <td className="py-2">
                  <span className={feeStatusClass(p.status as FeeStatus)}>
                    {PAYMENT_STATUS_LABEL[p.status as PaymentStatus]}
                  </span>
                </td>
                <td className="py-2 tabular-nums text-xs">
                  {p.payment_risk_score ?? "—"}
                </td>
                <td className="py-2">
                  {p.status === "pending" ? <ConfirmPaymentButton id={p.id} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CA mensuel */}
      <div className="card">
        <h2 className="font-semibold text-navy mb-3">CA mensuel (12 derniers mois)</h2>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end">
          {(monthly ?? []).slice(0, 12).reverse().map((row: Monthly) => {
            const max = Math.max(1, ...(monthly ?? []).map((r) => Number(r.confirmed_total)));
            const height = Math.max(4, (Number(row.confirmed_total) / max) * 100);
            return (
              <div key={row.month} className="flex flex-col items-center">
                <div
                  className="w-full bg-emerald-500 rounded-t"
                  style={{ height: `${height}px` }}
                  title={formatXof(Number(row.confirmed_total))}
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  {new Date(row.month).toLocaleDateString("fr-FR", { month: "short" })}
                </div>
              </div>
            );
          })}
          {(!monthly || monthly.length === 0) && (
            <p className="col-span-12 text-sm text-slate-400 text-center py-4">
              Pas encore de paiements encaissés.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-navy mb-2">Échéancier annuel</h3>
        <p className="text-sm text-slate-500 mb-3">
          Génère automatiquement les frais pour tous les élèves à partir du catalogue.
        </p>
        <Link
          href={`/dashboard/admin/paiements/schedule`}
          className="btn-secondary text-sm"
        >
          Générer l&apos;échéancier 2026-2027 →
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function MethodBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {formatXof(value)} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}