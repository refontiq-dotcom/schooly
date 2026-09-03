import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { generateYearlySchedule } from "@/lib/operations/actions";

export const revalidate = 0;

async function scheduleAction(formData: FormData) {
  "use server";
  const year = String(formData.get("school_year") ?? "2026-2027");
  await generateYearlySchedule(year);
  redirect("/dashboard/admin/paiements/schedule?generated=1");
}

export default async function SchedulePage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile || !supabase) redirect("/auth?returnTo=/dashboard/admin/paiements/schedule");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const etab = profile.establishment_id;

  const [{ data: categories }, { data: students }, { data: assignedFees }] = await Promise.all([
    supabase.from("fee_categories").select("*").eq("establishment_id", etab).order("due_date"),
    supabase.from("students").select("id, full_name").eq("establishment_id", etab),
    supabase.from("student_fees").select("fee_category_id").eq("establishment_id", etab),
  ]);

  const studentCount = students?.length ?? 0;
  const assignedByCategory = new Map<string, number>();
  for (const row of assignedFees ?? []) {
    assignedByCategory.set(row.fee_category_id, (assignedByCategory.get(row.fee_category_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Échéancier annuel</h1>
        <Link href="/dashboard/admin/paiements" className="btn-secondary">
          ← Vue d&apos;ensemble
        </Link>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-2">Générer l&apos;échéancier</h2>
        <p className="text-sm text-slate-500 mb-4">
          Pour chaque catégorie du catalogue, crée les <strong>{studentCount}</strong> échéances
          manquantes pour tous les élèves de l&apos;établissement. Idempotent : les échéances
          déjà créées ne sont pas dupliquées.
        </p>
        <form action={scheduleAction} className="flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="year" className="text-xs text-slate-500">
              Année scolaire
            </label>
            <input
              id="year"
              name="school_year"
              defaultValue="2026-2027"
              required
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary min-h-11">
            Générer
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-3">Catalogue vs couverture</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Catégorie</th>
              <th className="py-2">Année</th>
              <th className="py-2">Montant</th>
              <th className="py-2">Échéance</th>
              <th className="py-2">Couverture</th>
            </tr>
          </thead>
          <tbody>
            {(categories ?? []).map((c) => {
              const assigned = assignedByCategory.get(c.id) ?? 0;
              const pct = studentCount > 0 ? (assigned / studentCount) * 100 : 0;
              return (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2">{c.school_year}</td>
                  <td className="py-2 tabular-nums">{Number(c.amount).toLocaleString("fr-FR")} FCFA</td>
                  <td className="py-2">
                    {c.due_date ? new Date(c.due_date).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={
                            pct === 100
                              ? "h-full bg-emerald-500"
                              : pct >= 50
                              ? "h-full bg-amber-500"
                              : "h-full bg-red-500"
                          }
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">
                        {assigned} / {studentCount}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!categories || categories.length === 0) && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-400 text-center">
                  Aucun frais dans le catalogue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}