import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { SubmitDocumentButton } from "../_forms";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  documentStatusClass,
} from "@/lib/operations/labels";
import type { DocumentStatus, DocumentType } from "@/types";

export const revalidate = 0;

export default async function ParentDocumentsPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent/documents");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, sections(levels(name))")
    .eq("parent_id", user.id);
  const student = students?.[0];
  if (!student) return <div className="card text-slate-500">Aucun enfant rattaché.</div>;

  const { data: documents } = await supabase
    .from("student_documents")
    .select("*")
    .eq("student_id", student.id)
    .order("doc_type");

  const sectionRel = student.sections as unknown as
    | { levels?: { name: string } | { name: string }[] }
    | { levels?: { name: string } | { name: string }[] }[]
    | null;
  const section = Array.isArray(sectionRel) ? sectionRel[0] : sectionRel;
  const levelRel = section?.levels;
  const levelName = (Array.isArray(levelRel) ? levelRel[0]?.name : levelRel?.name) ?? "";
  const examSoon = /CM1|CM2|3ème|Terminale/i.test(levelName);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Documents — {student.full_name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Checklist administrative. Les actes de naissance manquants sont signalés automatiquement.
        </p>
      </div>

      {examSoon && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Niveau {levelName} : préparez dès maintenant le dossier d&apos;examen et la pièce d&apos;identité.
        </div>
      )}

      <div className="space-y-3">
        {(documents ?? []).map((doc) => (
          <div key={doc.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-navy">{DOCUMENT_TYPE_LABEL[doc.doc_type as DocumentType]}</p>
              <p className="text-xs text-slate-500">
                {doc.required ? "Obligatoire" : "Facultatif"}
                {doc.alert_from_level ? ` · alerte dès ${doc.alert_from_level}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={documentStatusClass(doc.status as DocumentStatus)}>
                {DOCUMENT_STATUS_LABEL[doc.status as DocumentStatus]}
              </span>
              {(doc.status === "missing" || doc.status === "rejected") && (
                <SubmitDocumentButton id={doc.id} />
              )}
            </div>
          </div>
        ))}
        {(!documents || documents.length === 0) && (
          <div className="card text-slate-500">Aucun document à suivre pour le moment.</div>
        )}
      </div>
    </div>
  );
}
