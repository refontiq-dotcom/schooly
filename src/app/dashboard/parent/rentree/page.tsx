import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { SupplyToggle } from "../_forms";
import { formatXof } from "@/lib/operations/labels";

export const revalidate = 0;

export default async function ParentRentreePage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/rentree");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, section_id, sections(level_id, name, levels(name))")
    .eq("parent_id", user.id);
  const student = students?.[0];
  if (!student) return <div className="card text-slate-500">Aucun enfant rattaché.</div>;

  const sectionRel = student.sections as unknown as
    | { level_id: string }
    | { level_id: string }[]
    | null;
  const levelId = (Array.isArray(sectionRel) ? sectionRel[0]?.level_id : sectionRel?.level_id);
  const { data: lists } = levelId
    ? await supabase
        .from("supply_lists")
        .select("*, supply_items(*)")
        .eq("level_id", levelId)
        .eq("published", true)
    : { data: [] };

  const { data: checks } = await supabase
    .from("student_supply_checks")
    .select("supply_item_id, purchased")
    .eq("student_id", student.id);
  const purchased = new Set((checks ?? []).filter((c) => c.purchased).map((c) => c.supply_item_id));

  const allItems = (lists ?? []).flatMap((l) => (l.supply_items ?? []) as { id: string; estimated_cost: number }[]);
  const total = allItems.reduce((s, i) => s + Number(i.estimated_cost), 0);
  const remainingCost = allItems
    .filter((i) => !purchased.has(i.id))
    .reduce((s, i) => s + Number(i.estimated_cost), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Rentrée sereine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Listes partagées, estimation des coûts et checklist pour {student.full_name}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budget fournitures</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{formatXof(total)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reste à acheter</p>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{formatXof(remainingCost)}</p>
        </div>
      </div>

      {(lists ?? []).map((list) => {
        const items = ([...(list.supply_items ?? [])] as {
          id: string;
          name: string;
          quantity: string;
          estimated_cost: number;
          is_optional: boolean;
        }[]).sort((a, b) => a.name.localeCompare(b.name));
        return (
          <div key={list.id} className="card">
            <h2 className="font-semibold text-navy">{list.title}</h2>
            {list.notes && <p className="text-sm text-slate-500 mt-1">{list.notes}</p>}
            <ul className="mt-4 divide-y divide-slate-100">
              {(Array.isArray(items) ? items : []).map((item) => (
                <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      Qté {item.quantity} · {formatXof(Number(item.estimated_cost))}
                      {item.is_optional ? " · optionnel" : ""}
                    </p>
                  </div>
                  <SupplyToggle studentId={student.id} itemId={item.id} purchased={purchased.has(item.id)} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {(!lists || lists.length === 0) && (
        <div className="card text-slate-500">
          Aucune liste de rentrée publiée pour ce niveau. L&apos;établissement peut la partager depuis l&apos;espace direction.
        </div>
      )}
    </div>
  );
}
