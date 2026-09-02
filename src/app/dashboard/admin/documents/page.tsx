import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { ValidateDocButton } from "../_ops-forms";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  documentStatusClass,
} from "@/lib/operations/labels";
import type { DocumentStatus, DocumentType } from "@/types";

export const revalidate = 0;

export default async function AdminDocumentsPage() {
  const { supabase, profile } = await getSessionProfile();
  if (!profile || !supabase) redirect("/auth?returnTo=/dashboard/admin/documents");
  if (profile.role !== "admin" || !profile.establishment_id) redirect("/dashboard/parent");

  const { data: documents } = await supabase
    .from("student_documents")
    .select("*, students(full_name, sections(levels(name)))")
    .eq("establishment_id", profile.establishment_id)
    .order("status");

  const missing = (documents ?? []).filter((d) => d.status === "missing" && d.required);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Documents administratifs</h1>
        <p className="text-sm text-slate-500 mt-1">
          {missing.length} document(s) obligatoire(s) manquant(s) — alertes dès CM1/CM2.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2">Élève</th>
              <th className="py-2">Niveau</th>
              <th className="py-2">Document</th>
              <th className="py-2">Statut</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(documents ?? []).map((d) => {
              const studentRel = d.students as unknown as
                | {
                    full_name?: string;
                    sections?: { levels?: { name: string } | { name: string }[] } | { levels?: { name: string } | { name: string }[] }[];
                  }
                | null;
              const sectionRel = Array.isArray(studentRel?.sections) ? studentRel?.sections[0] : studentRel?.sections;
              const levelRel = sectionRel?.levels;
              const levelName = Array.isArray(levelRel) ? levelRel[0]?.name : levelRel?.name;
              return (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2">{studentRel?.full_name ?? "—"}</td>
                  <td className="py-2">{levelName ?? "—"}</td>
                  <td className="py-2">{DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}</td>
                  <td className="py-2">
                    <span className={documentStatusClass(d.status as DocumentStatus)}>
                      {DOCUMENT_STATUS_LABEL[d.status as DocumentStatus]}
                    </span>
                  </td>
                  <td className="py-2">
                    {d.status === "submitted" ? (
                      <div className="flex gap-2">
                        <ValidateDocButton id={d.id} status="validated" />
                        <ValidateDocButton id={d.id} status="rejected" />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
