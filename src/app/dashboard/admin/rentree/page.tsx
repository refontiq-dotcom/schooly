import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { SupplyListForm } from "../_ops-forms";
import { formatXof } from "@/lib/operations/labels";

export const revalidate = 0;

export default async function AdminRentreePage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile || !supabase) redirect("/auth?returnTo=/dashboard/admin/rentree");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const [{ data: levels }, { data: lists }] = await Promise.all([
    supabase.from("levels").select("id, name").eq("establishment_id", profile.establishment_id).order("rank"),
    supabase
      .from("supply_lists")
      .select("*, supply_items(*), levels(name)")
      .eq("establishment_id", profile.establishment_id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Rentrée sereine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Publiez les listes de fournitures avec estimation des coûts pour éviter le chaos de septembre.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Nouvelle liste</h2>
        <SupplyListForm levels={levels ?? []} />
      </div>

      {(lists ?? []).map((list) => {
        const items = (list.supply_items ?? []) as { id: string; name: string; quantity: string; estimated_cost: number }[];
        const total = items.reduce((s, i) => s + Number(i.estimated_cost), 0);
        return (
          <div key={list.id} className="card">
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <div>
                <h2 className="font-semibold text-navy">{list.title}</h2>
                <p className="text-sm text-slate-500">{(list.levels as { name: string } | null)?.name}</p>
              </div>
              <p className="font-semibold tabular-nums">{formatXof(total)}</p>
            </div>
            <ul className="text-sm space-y-1">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.name} × {i.quantity}</span>
                  <span className="tabular-nums text-slate-500">{formatXof(Number(i.estimated_cost))}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
