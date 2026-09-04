import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

const SEVERITY_LABEL: Record<string, string> = {
  mineur: "Mineur",
  majeur: "Majeur",
  grave: "Grave",
};

const SEVERITY_CLASS: Record<string, string> = {
  mineur: "badge-success",
  majeur: "badge-warning",
  grave: "badge-danger",
};

export default async function ParentInternatPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/internat");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("parent_id", user.id);
  const student = students?.[0];
  if (!student) return <div className="card text-slate-500">Aucun enfant rattaché.</div>;

  const { data: assignment } = await supabase
    .from("internat_assignments")
    .select("*, internat_beds(bed_number, internat_rooms(number, internat_blocks(name)))")
    .eq("student_id", student.id)
    .eq("status", "actif")
    .maybeSingle();

  if (!assignment) {
    return (
      <div className="card text-slate-500">
        {student.full_name} n&apos;est pas actuellement affecté(e) à l&apos;internat.
      </div>
    );
  }

  const [{ data: recentRollItems }, { data: incidents }, { data: visits }, { data: healthRecords }] =
    await Promise.all([
      supabase
        .from("internat_roll_items")
        .select("*, internat_roll_calls(roll_call_date, roll_call_type)")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("internat_incidents")
        .select("*")
        .eq("student_id", student.id)
        .order("incident_date", { ascending: false })
        .limit(10),
      supabase
        .from("internat_visits")
        .select("*")
        .eq("student_id", student.id)
        .order("visit_date", { ascending: false })
        .limit(10),
      supabase
        .from("internat_health")
        .select("*")
        .eq("student_id", student.id)
        .order("check_date", { ascending: false })
        .limit(10),
    ]);

  const bed = assignment.internat_beds as {
    bed_number: number;
    internat_rooms: { number: string; internat_blocks: { name: string } };
  } | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Internat — {student.full_name}</h1>
        {bed && (
          <p className="text-sm text-slate-500 mt-1">
            Bâtiment {bed.internat_rooms?.internat_blocks?.name} — Chambre{" "}
            {bed.internat_rooms?.number} — Lit {bed.bed_number}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Derniers appels</h2>
        <ul className="space-y-1 text-sm">
          {recentRollItems?.map((r) => {
            const call = r.internat_roll_calls as { roll_call_date: string; roll_call_type: string } | null;
            return (
              <li key={r.id} className="flex justify-between">
                <span>
                  {call ? new Date(call.roll_call_date).toLocaleDateString("fr-FR") : "—"} (
                  {call?.roll_call_type === "matin" ? "Appel du matin" : "Appel du soir"})
                </span>
                <span className={r.present ? "text-emerald-600" : "text-red-600"}>
                  {r.present ? "Présent" : "Absent"}
                </span>
              </li>
            );
          })}
          {(!recentRollItems || recentRollItems.length === 0) && (
            <li className="text-slate-400">Aucun appel enregistré pour le moment.</li>
          )}
        </ul>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Incidents</h2>
          <ul className="space-y-2 text-sm">
            {incidents?.map((i) => (
              <li key={i.id} className="border-b border-slate-100 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i.title}</span>
                  <span className={SEVERITY_CLASS[i.severity] ?? "badge-warning"}>
                    {SEVERITY_LABEL[i.severity] ?? i.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(i.incident_date).toLocaleDateString("fr-FR")}
                </p>
              </li>
            ))}
            {(!incidents || incidents.length === 0) && (
              <li className="text-slate-400">Aucun incident signalé.</li>
            )}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Visites</h2>
          <ul className="space-y-2 text-sm">
            {visits?.map((v) => (
              <li key={v.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p className="font-medium">{v.visitor_name} {v.relationship ? `(${v.relationship})` : ""}</p>
                <p className="text-xs text-slate-400">
                  {new Date(v.visit_date).toLocaleDateString("fr-FR")}
                </p>
              </li>
            ))}
            {(!visits || visits.length === 0) && (
              <li className="text-slate-400">Aucune visite enregistrée.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Suivi santé</h2>
        <p className="text-xs text-slate-400 mb-3">
          Seuls les contrôles explicitement communiqués par l&apos;établissement apparaissent ici.
        </p>
        <ul className="space-y-2 text-sm">
          {healthRecords?.map((h) => (
            <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
              <div className="flex justify-between">
                <span>{new Date(h.check_date).toLocaleDateString("fr-FR")}</span>
                {h.temperature && <span>{h.temperature} °C</span>}
              </div>
              {h.symptoms && <p className="text-xs text-slate-500">Symptômes : {h.symptoms}</p>}
              {h.medication && <p className="text-xs text-slate-500">Médication : {h.medication}</p>}
            </li>
          ))}
          {(!healthRecords || healthRecords.length === 0) && (
            <li className="text-slate-400">Aucun élément de suivi santé communiqué pour le moment.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
