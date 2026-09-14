import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { StaffMessageForm } from "../_ops-forms";

export const revalidate = 0;

export default async function AdminMessagesPage() {
  const { supabase, profile, user } = await getSessionProfile();
  if (!profile || !supabase || !user) redirect("/auth?returnTo=/dashboard/admin/messages");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const [{ data: parents }, { data: messages }, { data: students }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, parent_id")
      .eq("establishment_id", profile.establishment_id)
      .not("parent_id", "is", null),
    supabase
      .from("messages")
      .select("*")
      .eq("establishment_id", profile.establishment_id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("students").select("id, full_name").eq("establishment_id", profile.establishment_id),
  ]);

  const names = Object.fromEntries((students ?? []).map((s) => [s.id, s.full_name]));
  const first = parents?.find((p) => p.parent_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Messagerie parents</h1>
        <p className="text-sm text-slate-500 mt-1">Notes, absences et informations administratives au même endroit.</p>
      </div>

      {first?.parent_id ? (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">
            Écrire au parent de {first.full_name}
          </h2>
          <StaffMessageForm recipientId={first.parent_id} studentId={first.id} />
        </div>
      ) : (
        <div className="card text-slate-500">Aucun parent rattaché pour l&apos;instant.</div>
      )}

      <div className="card space-y-3">
        {(messages ?? []).map((m) => (
          <article key={m.id} className="rounded-xl border border-slate-100 p-4">
            <p className="font-semibold text-navy">{m.subject}</p>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</p>
            <p className="text-xs text-slate-400 mt-2">
              {m.student_id ? names[m.student_id] : "Général"} · {new Date(m.created_at).toLocaleString("fr-FR")}
              {m.read_at ? " · lu" : " · non lu"}
            </p>
          </article>
        ))}
        {(!messages || messages.length === 0) && <p className="text-sm text-slate-400">Aucun message.</p>}
      </div>
    </div>
  );
}
