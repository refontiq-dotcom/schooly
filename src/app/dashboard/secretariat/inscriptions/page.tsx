import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { fetchEnrollmentPipeline, enrollmentRiskLabel } from "@/lib/enrollment-intelligence/scoring";
import { EnrollmentReviewActions } from "./review-actions";

export const revalidate = 0;

export default async function SmartEnrollmentPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/secretariat/inscriptions");
  if (!profile || !["admin", "secretariat", "censeur"].includes(profile.role)) redirect("/dashboard");

  const rows = profile.establishment_id
    ? await fetchEnrollmentPipeline(supabase, profile.establishment_id, 80)
    : [];

  const total = rows.length;
  const waiting = rows.filter((r) => ["submitted", "under_review", "incomplete"].includes(r.status)).length;
  const incomplete = rows.filter((r) => r.completeness_pct < 100).length;
  const risky = rows.filter((r) => r.duplicate_risk_score >= 80).length;
  const approved = rows.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/secretariat" className="text-sm text-slate-500 hover:text-blue-600">← Secrétariat</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy">Inscriptions intelligentes</h1>
          <p className="text-sm text-slate-500">Un dossier unique de la réservation jusqu'à l'élève inscrit.</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          🧠 Schooly analyse doublons, complétude et capacité avant décision.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Dossiers" value={total} />
        <Kpi label="À traiter" value={waiting} />
        <Kpi label="Incomplets" value={incomplete} tone="amber" />
        <Kpi label="Risque élevé" value={risky} tone="red" />
        <Kpi label="Validés" value={approved} tone="green" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-navy">File d'admission</h2>
          <p className="text-xs text-slate-500">Les recommandations restent soumises à validation humaine.</p>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">Aucun dossier d'inscription pour le moment.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <article key={row.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy">{row.student_full_name}</h3>
                      <Status status={row.status} />
                      {row.duplicate_risk_score >= 80 && <Badge tone="red">⚠️ {enrollmentRiskLabel(row.duplicate_risk_score)}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.requested_level_name} · Parent : {row.parent_full_name} · {row.parent_phone}
                    </p>
                    {row.duplicate_flags.length > 0 && (
                      <p className="mt-2 text-xs font-medium text-red-700">Contrôles : {row.duplicate_flags.join(" · ")}</p>
                    )}
                  </div>
                  <EnrollmentReviewActions id={row.id} canApprove={row.status !== "approved" && row.duplicate_risk_score < 80 && row.completeness_pct >= 100} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Insight label="Dossier" value={`${row.completeness_pct}%`} detail={row.completeness_pct >= 100 ? "Documents complets" : "Documents à vérifier"} />
                  <Insight label="Affectation" value={row.recommended_section_name ?? "Liste d'attente"} detail={row.recommendation_reason ?? "Aucune recommandation"} />
                  <Insight label="Risque doublon" value={`${row.duplicate_risk_score}/100`} detail={row.duplicate_risk_score >= 80 ? "Vérification obligatoire" : "Pas d'alerte forte"} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" | "red" | "green" }) {
  const colors = { slate: "text-slate-800", amber: "text-amber-600", red: "text-red-600", green: "text-emerald-600" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>;
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = { draft: "Brouillon", submitted: "Nouveau", under_review: "Étude", incomplete: "Incomplet", waitlisted: "Liste d'attente", approved: "Validé", rejected: "Refusé", cancelled: "Annulé" };
  return <Badge tone={status === "approved" ? "green" : status === "rejected" ? "red" : "blue"}>{labels[status] ?? status}</Badge>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "blue" | "red" | "green" }) {
  const colors = { blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-700", green: "bg-emerald-50 text-emerald-700" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}

function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
