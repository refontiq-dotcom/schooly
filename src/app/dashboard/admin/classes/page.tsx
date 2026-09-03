import AddLevelForm from "./add-level-form";
import AddSectionForm from "./add-section-form";
import { getSessionProfile } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function AdminClassesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/admin/classes");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: levels } = await supabase
    .from("levels")
    .select("*, sections(*)")
    .eq("establishment_id", establishment?.id ?? "")
    .order("rank");

  const { data: summary } = establishment
    ? await supabase
        .from("class_capacity_summary")
        .select("*")
        .eq("establishment_id", establishment.id)
        .maybeSingle()
    : { data: null };
  const { data: balanceAlerts } = establishment
    ? await supabase
        .from("class_balance_alerts")
        .select("*")
        .eq("establishment_id", establishment.id)
        .order("alert_level", { ascending: false })
        .limit(6)
    : { data: [] };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-navy">
        Classes & quotas {establishment ? `— ${establishment.name}` : ""}
      </h1>

      {!establishment && (
        <div className="card text-slate-500">
          Aucun établissement rattaché.{" "}
          <Link href="/onboarding/etablissement" className="text-amber-600 hover:underline">
            Créer un établissement
          </Link>
        </div>
      )}

      {/* Bandeau intelligence */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-slate-500">Remplissage global</p>
            <p className="text-2xl font-bold text-navy mt-1">{summary.global_fill_rate_pct}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {summary.total_taken} / {summary.total_capacity} places
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Places disponibles</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.total_seats_available}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.total_sections} section(s)</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Niveaux complets</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.full_levels}</p>
            <p className="text-xs text-slate-400 mt-1">à fermer / ouvrir</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">Niveaux sous-remplis</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.low_levels}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.normal_levels} normaux</p>
          </div>
        </div>
      )}

      {/* Alertes de déséquilibre */}
      {balanceAlerts && balanceAlerts.length > 0 && (
        <div className="card border-amber-200">
          <h2 className="font-semibold text-navy mb-3">⚠️ Alertes de déséquilibre</h2>
          <div className="space-y-2">
            {balanceAlerts.map((a) => (
              <div
                key={a.section_id}
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  a.alert_level === "critical"
                    ? "border-red-200 bg-red-50"
                    : a.alert_level === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {a.level_name} · {a.section_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.seats_available} place(s) dispo ·{" "}
                    {a.fill_status === "full"
                      ? "section complète"
                      : a.fill_status === "low"
                      ? "sous-remplissage"
                      : "presque complète"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{a.fill_rate_pct}%</span>
                  {a.alert_level === "critical" && (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                      Critique
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {establishment && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Ajouter un niveau</h2>
          <AddLevelForm establishmentId={establishment.id} />
        </div>
      )}

      <div className="space-y-5">
        {levels?.map((level) => {
          const sections = level.sections as { id: string; name: string; capacity: number; seats_taken: number }[];
          const totalCapacity = sections.reduce((s, sec) => s + sec.capacity, 0);
          const totalTaken = sections.reduce((s, sec) => s + sec.seats_taken, 0);
          const levelRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;

          return (
            <div key={level.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg text-navy">{level.name}</h3>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        levelRate >= 100 ? "bg-red-500" :
                        levelRate >= 90 ? "bg-amber-500" :
                        levelRate < 50 ? "bg-orange-400" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, levelRate)}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500">
                    {totalTaken} / {totalCapacity} ({levelRate}%)
                  </span>
                </div>
              </div>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2">Section</th>
                    <th className="py-2">Capacité</th>
                    <th className="py-2">Places prises</th>
                    <th className="py-2">Disponibles</th>
                    <th className="py-2">Remplissage</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => {
                    const secRate = sec.capacity > 0 ? Math.round((sec.seats_taken / sec.capacity) * 100) : 0;
                    return (
                      <tr key={sec.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 font-medium">{sec.name}</td>
                        <td className="py-2">{sec.capacity}</td>
                        <td className="py-2">{sec.seats_taken}</td>
                        <td className="py-2">{sec.capacity - sec.seats_taken}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                              <div
                                className={`h-full rounded-full ${
                                  secRate >= 100 ? "bg-red-500" :
                                  secRate >= 90 ? "bg-amber-500" :
                                  secRate < 50 ? "bg-orange-400" :
                                  "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(100, secRate)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{secRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sections.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-400">
                        Aucune section pour ce niveau.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <AddSectionForm levelId={level.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
