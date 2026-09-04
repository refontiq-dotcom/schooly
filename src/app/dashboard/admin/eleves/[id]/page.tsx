import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
  BEHAVIOR_KIND_LABEL,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  FEE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  documentStatusClass,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import {
  GRADE_BUCKET_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
  averageScore,
  gradeBucket,
  normalizeScore,
  type RiskLevel,
} from "@/lib/teacher-intelligence/scoring";
import {
  EVALUATION_TYPE_LABEL,
  attendanceRateFromRecords,
  behaviorBalance,
  groupGradesByEvaluationType,
  groupGradesBySubject,
} from "@/lib/student-intelligence/scoring";
import { INSCRIPTION_MODALITY_LABELS, type BehaviorKind, type DocumentStatus, type DocumentType, type FeeStatus, type InscriptionModality, type PaymentMethod, type PaymentStatus } from "@/types";

export const revalidate = 0;

export default async function AdminStudentDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; section?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect(`/auth?returnTo=/dashboard/admin/eleves/${id}`);
  }
  if (!profile || profile.role !== "admin" || !profile.establishment_id) {
    redirect("/dashboard/parent");
  }

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, birthdate, parent_phone, parent_id, section_id, reservation_id, created_at, modality, establishment_id, sections(id, name, levels(id, name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!student || student.establishment_id !== profile.establishment_id) {
    return notFound();
  }

  const section = firstRelation(student.sections) as {
    id?: string;
    name?: string;
    levels?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  } | null;
  const level = firstRelation(section?.levels);
  const levelName = level && typeof level === "object" && "name" in level ? String(level.name ?? "") : "";
  const sectionName = section?.name ?? "";
  const backHref = query.section
    ? `/dashboard/admin/classes/${query.section}`
    : student.section_id
      ? `/dashboard/admin/classes/${student.section_id}`
      : "/dashboard/admin/classes";

  const [
    { data: summary },
    { data: ranking },
    { data: atRisk },
    { data: prediction },
    { data: reportCard },
    { data: grades },
    { data: attendance },
    { data: notes },
    { data: fees },
    { data: payments },
    { data: documents },
    { data: internat },
    { data: parentProfile },
    { data: reservation },
  ] = await Promise.all([
    supabase.from("parent_dashboard_summary").select("*").eq("student_id", id).maybeSingle(),
    supabase.from("student_class_ranking").select("*").eq("student_id", id).maybeSingle(),
    supabase.from("students_at_risk").select("*").eq("student_id", id).maybeSingle(),
    supabase.from("student_predictions").select("*").eq("student_id", id).maybeSingle(),
    supabase.from("student_report_card").select("*").eq("student_id", id).order("subject"),
    supabase.from("grades").select("*").eq("student_id", id).order("evaluation_date", { ascending: false }).limit(80),
    supabase.from("attendance_records").select("*").eq("student_id", id).order("session_date", { ascending: false }).limit(60),
    supabase.from("behavior_notes").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("student_fees").select("*, fee_categories(name)").eq("student_id", id).order("due_date"),
    supabase.from("payments").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("student_documents").select("*").eq("student_id", id),
    supabase
      .from("internat_assignments")
      .select("id, academic_year, status, start_date, internat_beds(bed_number, internat_rooms(number, internat_blocks(name)))")
      .eq("student_id", id)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    student.parent_id
      ? supabase.from("profiles").select("id, full_name, email, phone").eq("id", student.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    student.reservation_id
      ? supabase
          .from("reservations")
          .select("id, status, parent_full_name, parent_email, created_at, confirmed_at")
          .eq("id", student.reservation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const gradeRows = grades ?? [];
  const attendanceRows = attendance ?? [];
  const noteRows = notes ?? [];
  const bySubject = groupGradesBySubject(gradeRows);
  const byType = groupGradesByEvaluationType(gradeRows);
  const globalAverage =
    gradeRows.length > 0
      ? Math.round(averageScore(gradeRows.map((g) => normalizeScore(g.score, g.max_score))) * 10) / 10
      : 0;
  const assiduite = attendanceRateFromRecords(attendanceRows);
  const conduct = behaviorBalance(noteRows);
  const riskLevel = (atRisk?.risk_level ?? "low") as RiskLevel;
  const modality = (student as { modality?: InscriptionModality }).modality;
  const age = student.birthdate ? ageFromBirthdate(student.birthdate) : null;
  const internatLabel = internatLabelFromAssignment(internat);

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-500 hover:text-navy inline-flex items-center min-h-11">
          Retour à {sectionName || "la classe"}
        </Link>
        <div className="mt-2 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {levelName} · {sectionName}
            </p>
            <h1 className="text-2xl font-bold text-navy">{student.full_name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {age !== null ? `${age} ans` : "Âge inconnu"}
              {student.birthdate ? ` · né(e) le ${formatDate(student.birthdate)}` : ""}
              {modality ? ` · ${INSCRIPTION_MODALITY_LABELS[modality] ?? modality}` : ""}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${RISK_LEVEL_COLOR[riskLevel]}`}>
            {RISK_LEVEL_LABEL[riskLevel]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Moyenne générale"
          value={gradeRows.length > 0 ? `${globalAverage}/20` : "—"}
          hint={ranking ? `Rang ${ranking.rank_in_section}/${ranking.section_size}` : `${gradeRows.length} note(s)`}
        />
        <Kpi
          label="Assiduité"
          value={assiduite !== null ? `${assiduite}%` : "—"}
          hint={`${attendanceRows.filter((a) => !a.present).length} absence(s)`}
        />
        <Kpi
          label="Conduite"
          value={`${conduct.positif} / ${conduct.incident}`}
          hint="positifs / incidents"
        />
        <Kpi
          label="Projection"
          value={prediction?.predicted_average != null ? `${Number(prediction.predicted_average).toFixed(1)}/20` : "—"}
          hint={summary?.has_recent_drop ? "Baisse récente" : "Tendance récente"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Identité &amp; famille</h2>
          <dl className="text-sm space-y-2">
            <Row label="Classe" value={`${levelName} ${sectionName}`.trim() || "—"} />
            <Row label="Téléphone parent" value={student.parent_phone || "—"} />
            <Row label="Parent" value={parentProfile?.full_name || reservation?.parent_full_name || "Non rattaché"} />
            <Row label="Email parent" value={parentProfile?.email || reservation?.parent_email || "—"} />
            <Row label="Inscrit le" value={student.created_at ? formatDate(student.created_at) : "—"} />
            {internatLabel && <Row label="Internat" value={internatLabel} />}
          </dl>
        </div>
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Moyennes par type d&apos;évaluation</h2>
          {byType.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {byType.map((t) => (
                <li key={t.evaluationType} className="flex justify-between gap-3">
                  <span>{EVALUATION_TYPE_LABEL[t.evaluationType] ?? t.evaluationType}</span>
                  <span className="tabular-nums font-semibold">
                    {t.average}/20 <span className="text-slate-400 font-normal">({t.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucune évaluation enregistrée.</p>
          )}
          {reportCard && reportCard.length > 0 && (
            <p className="text-xs text-slate-400 mt-3">Bulletin glissant 120 jours : {reportCard.length} matière(s).</p>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-3">Moyennes par matière</h2>
        {bySubject.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Matière</th>
                <th className="py-2 pr-3">Moyenne</th>
                <th className="py-2 pr-3">Min / Max</th>
                <th className="py-2">Niveau</th>
              </tr>
            </thead>
            <tbody>
              {bySubject.map((s) => (
                <tr key={s.subject} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{s.subject}</td>
                  <td className="py-2.5 pr-3 tabular-nums font-semibold">{s.average}/20</td>
                  <td className="py-2.5 pr-3 tabular-nums text-slate-500">
                    {s.min} – {s.max}
                  </td>
                  <td className="py-2.5 text-slate-600">{GRADE_BUCKET_LABEL[s.bucket]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Pas encore de notes par matière.</p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-navy mb-3">Historique des notes</h2>
        {gradeRows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Matière</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {gradeRows.map((g) => {
                const n = normalizeScore(g.score, g.max_score);
                const bucket = gradeBucket(n);
                return (
                  <tr key={g.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3 text-slate-500">{formatDate(g.evaluation_date)}</td>
                    <td className="py-2.5 pr-3 font-medium">{g.subject}</td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {EVALUATION_TYPE_LABEL[g.evaluation_type] ?? g.evaluation_type}
                    </td>
                    <td className="py-2.5 tabular-nums">
                      {g.score}/{g.max_score}
                      <span className="text-xs text-slate-400 ml-2">{GRADE_BUCKET_LABEL[bucket].split(" ")[0]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Aucune note.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-navy mb-3">Présences</h2>
          {attendanceRows.length > 0 ? (
            <ul className="space-y-1.5 text-sm max-h-80 overflow-y-auto">
              {attendanceRows.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{formatDate(a.session_date)}</span>
                  <span className={a.present ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                    {a.present ? "Présent" : "Absent"}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucune séance enregistrée.</p>
          )}
        </div>
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-navy mb-3">Conduite</h2>
          {noteRows.length > 0 ? (
            <ul className="space-y-3 text-sm max-h-80 overflow-y-auto">
              {noteRows.map((n) => (
                <li key={n.id} className="border-b border-slate-100 pb-2 last:border-0">
                  <p className="font-medium text-slate-800">
                    {BEHAVIOR_KIND_LABEL[n.kind as BehaviorKind] ?? n.kind}
                    {n.title ? ` · ${n.title}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {n.session_date ? formatDate(n.session_date) : n.created_at ? formatDate(n.created_at) : ""}
                  </p>
                  {n.body && <p className="text-slate-600 mt-1">{n.body}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucun incident ni observation.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-navy mb-3">Frais scolaires</h2>
          {fees && fees.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {fees.map((f) => {
                const catName = relationName(f.fee_categories) ?? "Frais";
                const remaining = Number(f.amount) - Number(f.amount_paid);
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{catName}</p>
                      <p className="text-xs text-slate-500">
                        {f.due_date ? `Échéance ${formatDate(f.due_date)}` : "Sans échéance"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={feeStatusClass(f.status as FeeStatus)}>
                        {FEE_STATUS_LABEL[f.status as FeeStatus] ?? f.status}
                      </span>
                      <p className="text-xs tabular-nums mt-1">{formatXof(remaining)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucun frais rattaché.</p>
          )}
          {payments && payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Paiements</p>
              <ul className="space-y-1.5 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {formatXof(p.amount)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}
                    </span>
                    <span className="text-slate-500">
                      {PAYMENT_STATUS_LABEL[p.status as PaymentStatus] ?? p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Documents</h2>
          {documents && documents.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType] ?? d.doc_type}</span>
                  <span className={documentStatusClass(d.status as DocumentStatus)}>
                    {DOCUMENT_STATUS_LABEL[d.status as DocumentStatus] ?? d.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucun document suivi.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-navy mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function ageFromBirthdate(birthdate: string) {
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function firstRelation(rel: unknown): Record<string, unknown> | null {
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

function relationName(rel: unknown): string | null {
  const row = firstRelation(rel);
  const name = row?.name;
  return typeof name === "string" ? name : null;
}

function internatLabelFromAssignment(assignment: unknown): string | null {
  const row = firstRelation(assignment);
  if (!row) return null;
  const bed = firstRelation(row.internat_beds);
  const room = firstRelation(bed?.internat_rooms);
  const block = firstRelation(room?.internat_blocks);
  const parts = [
    typeof block?.name === "string" ? `Bâtiment ${block.name}` : null,
    typeof room?.number === "string" ? `ch. ${room.number}` : null,
    typeof bed?.bed_number === "number" ? `lit ${bed.bed_number}` : null,
    typeof row.status === "string" ? row.status : null,
    typeof row.academic_year === "string" ? row.academic_year : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
