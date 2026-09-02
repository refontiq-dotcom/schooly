import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { MessageForm } from "../_forms";

export const revalidate = 0;

export default async function ParentMessagesPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/messages");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, establishment_id")
    .eq("parent_id", user.id);
  const student = students?.[0];

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(40);

  const staff = student?.establishment_id
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("establishment_id", student.establishment_id)
          .in("role", ["admin", "secretariat", "censeur"])
      ).data
    : [];

  const defaultRecipient = staff?.[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Messagerie école ↔ parents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Un canal unique pour notes, absences et questions administratives.
        </p>
      </div>

      {defaultRecipient ? (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Écrire à l&apos;établissement</h2>
          <MessageForm recipientId={defaultRecipient} studentId={student?.id} />
        </div>
      ) : (
        <div className="card text-slate-500">
          Aucun contact établissement disponible tant qu&apos;un enfant n&apos;est pas rattaché.
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="font-semibold text-navy">Fil de discussion</h2>
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <article
              key={m.id}
              className={`rounded-xl p-4 ${mine ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-slate-100"}`}
            >
              <p className="text-sm font-semibold text-navy">{m.subject}</p>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</p>
              <p className="text-xs text-slate-400 mt-2">
                {mine ? "Vous" : "Établissement"} · {new Date(m.created_at).toLocaleString("fr-FR")}
              </p>
            </article>
          );
        })}
        {(!messages || messages.length === 0) && (
          <p className="text-sm text-slate-400">Aucun message pour le moment.</p>
        )}
      </div>
    </div>
  );
}
