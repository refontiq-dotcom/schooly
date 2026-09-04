import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { findParentStudents, groupByEstablishment, resolveEstablishmentId } from "@/lib/parent/context";
import { PayFeeForm } from "../_forms";
import {
  FEE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import {
  INSCRIPTION_MODALITY_LABELS,
  INSCRIPTION_MODALITY_ICONS,
} from "@/types";
import type { FeeStatus, PaymentMethod, PaymentStatus, InscriptionModality } from "@/types";

export const revalidate = 0;

export default async function ParentPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estab?: string; student?: string }>;
}) {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/paiements");

  const params = await searchParams;
  const students = await findParentStudents(supabase, user.id);
  const groups = groupByEstablishment(students);
  const selectedEstabId = resolveEstablishmentId(groups, params.estab ?? null);

  const selectedGroup = groups.find((g) => g.establishment.id === selectedEstabId);
  const currentStudents = selectedGroup?.students ?? [];
  const selectedStudentId = params.student ?? currentStudents[0]?.id ?? null;
  const student = currentStudents.find((s) => s.id === selectedStudentId) ?? currentStudents[0];

  if (!student) {
    return <div className="card text-slate-500">Aucun enfant rattaché.</div>;
  }

  const [{ data: fees }, { data: categories }, { data: payments }, { data: reservation }, { data: inscriptionFee }] = await Promise.all([
    supabase.from("student_fees").select("*").eq("student_id", student.id).order("due_date"),
    supabase.from("fee_categories").select("id, name"),
    supabase.from("payments").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
    // Récupérer la réservation pour connaître la modalité
    supabase
      .from("reservations")
      .select("modality, establishment_id")
      .eq("id", student.reservation_id ?? "")
      .maybeSingle(),
    // Récupérer la catégorie de frais "inscription"
    supabase
      .from("fee_categories")
      .select("id, name, amount")
      .eq("establishment_id", selectedEstabId ?? "")
      .ilike("name", "%inscription%")
      .maybeSingle(),
  ]);

  // Récupérer la configuration de modalité (fee_multiplier)
  let modalityConfig: { modality: string; name: string; fee_multiplier: number; description: string | null }[] | null = null;
  if (selectedEstabId) {
    const { data } = await supabase
      .from("inscription_modalities")
      .select("modality, name, fee_multiplier, description")
      .eq("establishment_id", selectedEstabId)
      .eq("is_active", true);
    modalityConfig = data;
  }

  const catName = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]));
  const remaining = (fees ?? []).reduce((s, f) => s + Number(f.amount) - Number(f.amount_paid), 0);
  const paid = (fees ?? []).reduce((s, f) => s + Number(f.amount_paid), 0);

  // Calculer les frais d'inscription selon la modalité
  const studentModality = (reservation?.modality as InscriptionModality) ?? "standard";
  const modalityMultiplier = modalityConfig?.find(
    (m: { modality: string; fee_multiplier: number }) => m.modality === studentModality
  )?.fee_multiplier ?? 1.0;
  const baseInscriptionFee = inscriptionFee?.amount ?? 0;
  const inscriptionFeeAmount = Math.round(baseInscriptionFee * modalityMultiplier * 100) / 100;
  const inscriptionFeeLabel = modalityConfig?.find(
    (m: { modality: string; name: string }) => m.modality === studentModality
  )?.name ?? "Inscription standard";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Paiements — {student.full_name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Mobile Money, échéanciers et historique clair des restes à payer.
          {selectedGroup && (
            <span className="text-slate-400 ml-2">
              · {selectedGroup.establishment.name}
            </span>
          )}
        </p>
      </div>

      {/* ── Carte frais d'inscription avec modalité ── */}
      {inscriptionFeeAmount > 0 && (
        <div className={`rounded-2xl border-2 p-5 ${
          inscriptionFeeAmount === 0
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-start gap-4">
            <span className="text-3xl shrink-0">
              {INSCRIPTION_MODALITY_ICONS[studentModality]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-slate-800">Frais d&apos;inscription</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  studentModality === "bourse" ? "bg-emerald-100 text-emerald-700"
                  : studentModality === "fratrie" ? "bg-amber-100 text-amber-700"
                  : studentModality === "transfert" ? "bg-blue-100 text-blue-700"
                  : studentModality === "convention" ? "bg-purple-100 text-purple-700"
                  : "bg-slate-100 text-slate-700"
                }`}>
                  {INSCRIPTION_MODALITY_LABELS[studentModality]}
                </span>
              </div>

              <p className="text-sm text-slate-600 mb-3">{inscriptionFeeLabel}</p>

              {modalityMultiplier < 1 && (
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <span className="text-slate-500">Tarif normal :</span>
                  <span className="line-through text-slate-400">{formatXof(baseInscriptionFee)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-500">{Math.round(modalityMultiplier * 100)}%</span>
                </div>
              )}

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Montant dû</p>
                  <p className="text-2xl font-bold text-slate-800">{formatXof(inscriptionFeeAmount)}</p>
                </div>
                {inscriptionFeeAmount === 0 ? (
                  <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg">
                    ✅ Gratuit (bourse)
                  </span>
                ) : (
                  <span className="text-sm font-medium text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg">
                    💳 À payer
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Résumé global ── */}
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

      {/* ── Liste des frais ── */}
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

      {/* ── Historique ── */}
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
