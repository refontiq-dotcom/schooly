import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function ParentInscriptionsPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/inscriptions");

  const { data: applications, error } = await supabase
    .from("enrollment_applications")
    .select("id,status,modality,student_full_name,completeness_pct,duplicate_risk_score,recommendation_score,recommendation_reason,created_at,requested_level_id,parent_phone,establishment_id")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="card text-sm text-red-600">Impossible de charger vos inscriptions.</div>;
  }

  const levelIds = [...new Set((applications ?? []).map((a) => a.requested_level_id))];
  const { data: levels } = levelIds.length
    ? await supabase.from("levels").select("id,name").in("id", levelIds)
    : { data: [] };
  const levelNames = Object.fromEntries((levels ?? []).map((l) => [l.id, l.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Schooly</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Mes inscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">Tous les dossiers associés à votre numéro, même dans des établissements différents.</p>
      </div>

      {(applications ?? []).length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Aucun dossier d'inscription associé à ce numéro.
        </div>
      ) : (
        <div className="space-y-3">
          {(applications ?? []).map((a) => (
            <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-navy">{a.student_full_name}</h2>
                  <p className="text-sm text-slate-500">{levelNames[a.requested_level_id] ?? "Niveau demandé"}</p>
                </div>
                <Status status={a.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Dossier" value={`${a.completeness_pct}%`} />
                <Metric label="Affectation" value={a.recommendation_score ? `${a.recommendation_score}/100` : "En étude"} />
              </div>
              {a.recommendation_reason && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">💡 {a.recommendation_reason}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = { draft: "Brouillon", submitted: "Reçu", under_review: "En étude", incomplete: "À compléter", waitlisted: "Liste d'attente", approved: "Validé", rejected: "Refusé", cancelled: "Annulé" };
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{labels[status] ?? status}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-navy">{value}</p></div>;
}
