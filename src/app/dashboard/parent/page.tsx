import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  FEE_STATUS_LABEL,
  BEHAVIOR_KIND_LABEL,
  documentStatusClass,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import { IconAlert, IconBackpack, IconChart, IconFile, IconWallet } from "@/components/icons";
import type { DocumentStatus, DocumentType, FeeStatus, BehaviorKind } from "@/types";

export const revalidate = 0;

export default async function ParentDashboardPage() {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/parent");
  }

  const { data: students } = await supabase
    .from("students")
    .select("*, sections(name, levels(name, rank))")
    .eq("parent_id", user.id);

  const student = students?.[0];

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
            <Link href="/onboarding/etablissement" className="btn-primary min-h-11">
              Créer un établissement
            </Link>
          </div>
        )}
      </div>
    );
  }

  const [{ data: attendance }, { data: grades }, { data: fees }, { data: documents }, { data: notes }] =
    await Promise.all([
      supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", student.id)
        .order("session_date", { ascending: false })
        .limit(10),
      supabase
        .from("grades")
        .select("*")
        .eq("student_id", student.id)
        .order("evaluation_date", { ascending: false })
        .limit(10),
      supabase.from("student_fees").select("*").eq("student_id", student.id),
      supabase.from("student_documents").select("*").eq("student_id", student.id),
      supabase
        .from("behavior_notes")
        .select("*")
        .eq("student_id", student.id)
        .order("session_date", { ascending: false })
        .limit(5),
    ]);

  const presentCount = attendance?.filter((a) => a.present).length ?? 0;
  const totalCount = attendance?.length ?? 0;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;
  const remaining = (fees ?? []).reduce((s, f) => s + Number(f.amount) - Number(f.amount_paid), 0);
  const overdue = (fees ?? []).filter((f) => f.status === "overdue").length;
  const missingDocs = (documents ?? []).filter((d) => d.required && d.status === "missing").length;
  const recentDrop =
    (grades ?? []).length >= 2 &&
    Number(grades![0].score) / Number(grades![0].max_score) <
      Number(grades![1].score) / Number(grades![1].max_score) - 0.15;
  const absences = (attendance ?? []).filter((a) => !a.present).length;

  const sectionRel = student.sections as unknown as
    | { name?: string; levels?: { name: string } | { name: string }[] }
    | { name?: string; levels?: { name: string } | { name: string }[] }[]
    | null;
  const section = Array.isArray(sectionRel) ? sectionRel[0] : sectionRel;
  const levelRel = section?.levels;
  const levelName = Array.isArray(levelRel) ? levelRel[0]?.name : levelRel?.name;
  const sectionName = section?.name;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{student.full_name}</h1>
        <p className="text-slate-500">
          {levelName} — {sectionName}
        </p>
      </div>

      {(overdue > 0 || missingDocs > 0 || absences >= 3 || recentDrop) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <IconAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-1">
            <p className="font-semibold">Alertes à traiter</p>
            {overdue > 0 && <p>{overdue} échéance(s) en retard — régularisez pour éviter le blocage de rentrée.</p>}
            {missingDocs > 0 && <p>{missingDocs} document(s) manquant(s), notamment l&apos;acte de naissance.</p>}
            {absences >= 3 && <p>Plusieurs absences récentes : contactez l&apos;établissement si besoin.</p>}
            {recentDrop && <p>Baisse de notes récente — un suivi plus rapproché est recommandé.</p>}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/parent/paiements" className="card hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <IconWallet className="w-4 h-4" /> Restant à payer
          </div>
          <p className="text-2xl font-bold text-navy">{formatXof(remaining)}</p>
        </Link>
        <Link href="/dashboard/parent/documents" className="card hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <IconFile className="w-4 h-4" /> Documents
          </div>
          <p className="text-2xl font-bold text-navy">{missingDocs} manquant(s)</p>
        </Link>
        <div className="card">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <IconChart className="w-4 h-4" /> Assiduité
          </div>
          <p className="text-2xl font-bold text-navy">{attendanceRate !== null ? `${attendanceRate}%` : "—"}</p>
        </div>
        <Link href="/dashboard/parent/rentree" className="card hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <IconBackpack className="w-4 h-4" /> Rentrée sereine
          </div>
          <p className="text-sm text-slate-600">Listes, coûts et checklist</p>
        </Link>
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
                <span className={a.present ? "text-emerald-700" : "text-red-700"}>
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
              <li key={g.id} className="flex justify-between gap-3">
                <span>
                  {g.subject} — {g.evaluation_type} ({new Date(g.evaluation_date).toLocaleDateString("fr-FR")})
                </span>
                <span className="font-medium tabular-nums">{g.score} / {g.max_score}</span>
              </li>
            ))}
            {(!grades || grades.length === 0) && (
              <li className="text-slate-400">Aucune note enregistrée pour le moment.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-navy">Frais</h2>
            <Link href="/dashboard/parent/paiements" className="text-sm text-amber-700 font-medium">Tout voir</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {(fees ?? []).slice(0, 4).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className={feeStatusClass(f.status as FeeStatus)}>{FEE_STATUS_LABEL[f.status as FeeStatus]}</span>
                <span className="tabular-nums">{formatXof(Number(f.amount) - Number(f.amount_paid))}</span>
              </li>
            ))}
            {(!fees || fees.length === 0) && <li className="text-slate-400">Aucun frais publié pour l&apos;instant.</li>}
          </ul>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-navy">Comportement</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {(notes ?? []).map((n) => (
              <li key={n.id}>
                <span className="font-medium">{BEHAVIOR_KIND_LABEL[n.kind as BehaviorKind]}</span>
                {" — "}
                {n.title}
              </li>
            ))}
            {(!notes || notes.length === 0) && <li className="text-slate-400">Aucun signalement.</li>}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Documents</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {(documents ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span>{DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}</span>
              <span className={documentStatusClass(d.status as DocumentStatus)}>
                {DOCUMENT_STATUS_LABEL[d.status as DocumentStatus]}
              </span>
            </li>
          ))}
          {(!documents || documents.length === 0) && (
            <li className="text-slate-400">Checklist documents non initialisée.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
