import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

/**
 * Affiche le suivi du premier enfant rattaché (students.parent_id = auth.uid()).
 * Le rattachement se fait à la finalisation d'inscription (email/téléphone)
 * ou au premier login parent via link_parent_to_students().
 */
export default async function ParentDashboardPage() {
  const { supabase, user, profile } = await getSessionProfile();

  const { data: students } = await supabase
    .from("students")
    .select("*, sections(name, levels(name))")
    .eq("parent_id", user?.id ?? "");

  const student = students?.[0];

  const { data: attendance } = student
    ? await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", student.id)
        .order("session_date", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: grades } = student
    ? await supabase
        .from("grades")
        .select("*")
        .eq("student_id", student.id)
        .order("evaluation_date", { ascending: false })
        .limit(10)
    : { data: [] };

  if (!user) {
    return (
      <div className="card text-slate-500">
        Connectez-vous pour accéder au suivi de votre enfant.
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <div className="card text-slate-500">
          Aucun enfant rattaché à votre compte pour le moment. Une fois
          l&apos;inscription finalisée par l&apos;établissement (avec le même
          email), le suivi apparaîtra ici automatiquement.
        </div>
        {profile?.role === "parent" && !profile.establishment_id && (
          <div className="card">
            <h2 className="font-semibold text-navy mb-2">Vous dirigez un établissement ?</h2>
            <p className="text-sm text-slate-500 mb-3">
              Créez votre établissement pour obtenir le rôle administrateur.
              Le personnel (professeurs, secrétariat) sera ensuite invité.
            </p>
            <Link href="/onboarding/etablissement" className="btn-primary">
              Créer un établissement
            </Link>
          </div>
        )}
      </div>
    );
  }

  const presentCount = attendance?.filter((a) => a.present).length ?? 0;
  const totalCount = attendance?.length ?? 0;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{student.full_name}</h1>
        <p className="text-slate-500">
          {(student.sections as { name: string; levels: { name: string } })?.levels?.name} —{" "}
          {(student.sections as { name: string })?.name}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Assiduité (10 dernières séances)</h2>
          {attendanceRate !== null ? (
            <p className="text-3xl font-bold text-brand">{attendanceRate}%</p>
          ) : (
            <p className="text-slate-400">Aucune donnée de présence pour le moment.</p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {attendance?.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>{new Date(a.session_date).toLocaleDateString("fr-FR")}</span>
                <span className={a.present ? "text-emerald-600" : "text-red-600"}>
                  {a.present ? "Présent" : "Absent"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Dernières notes</h2>
          <ul className="space-y-1 text-sm">
            {grades?.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>
                  {g.subject} — {g.evaluation_type} ({new Date(g.evaluation_date).toLocaleDateString("fr-FR")})
                </span>
                <span className="font-medium">{g.score} / {g.max_score}</span>
              </li>
            ))}
            {(!grades || grades.length === 0) && (
              <li className="text-slate-400">Aucune note enregistrée pour le moment.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="card bg-slate-50 text-sm text-slate-500">
        📲 Vous recevez également un récapitulatif hebdomadaire par WhatsApp chaque fin de semaine.
      </div>
    </div>
  );
}
