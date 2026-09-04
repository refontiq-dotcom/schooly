import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  feeStatusClass,
  formatXof,
} from "@/lib/operations/labels";
import {
  ALERT_ICON,
  ALERT_LABEL,
  SEVERITY_COLOR,
  buildParentAlerts,
} from "@/lib/parent-intelligence/scoring";
import type { DocumentStatus, DocumentType } from "@/types";

export const revalidate = 0;

type ChildSummaryRow = {
  student_id: string;
  parent_id: string | null;
  full_name: string;
  level_name: string | null;
  section_name: string | null;
  current_average: number;
  grades_count_90d: number;
  last_grade_date: string | null;
  latest_2_avg: number;
  previous_2_avg: number;
  has_recent_drop: boolean;
  attendance_pct_30d: number | null;
  recent_absences: number;
  fees_remaining: number;
  fees_overdue_count: number;
  docs_missing_count: number;
  behavior_concerns_count: number;
  parent_satisfaction_score: number;
};

type RankRow = {
  student_id: string;
  student_name: string;
  section_id: string;
  section_name: string;
  class_average: number;
  rank_in_section: number;
  section_size: number;
  percentile: number;
};

type AlertRow = {
  student_id: string;
  full_name: string;
  parent_id: string | null;
  alerts: Array<{
    type: string;
    severity: "low" | "medium" | "high" | "positive";
    title: string;
    message: string;
  }>;
};

export default async function ParentDashboardPage() {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/parent");
  }

  const { data: summaries } = await supabase
    .from("parent_dashboard_summary")
    .select("*")
    .eq("parent_id", user.id)
    .order("full_name");

  const children = summaries ?? [];

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card text-slate-500">
          Aucun enfant rattaché à votre compte pour le moment. Une fois
          l&apos;inscription finalisée par l&apos;établissement (avec le même
          email), le suivi apparaîtra ici automatiquement.
        </div>
      </div>
    );
  }

  const studentIds = children.map((c: ChildSummaryRow) => c.student_id);

  const [
    { data: ranks },
    { data: alertsRows },
    { data: attendance },
    { data: grades },
    { data: fees },
    { data: documents },
    { data: notes },
  ] = await Promise.all([
    supabase.from("student_class_ranking").select("*").in("student_id", studentIds),
    supabase.from("parent_alerts").select("*").in("student_id", studentIds),
    supabase
      .from("attendance_records")
      .select("*")
      .in("student_id", studentIds)
      .order("session_date", { ascending: false })
      .limit(20),
    supabase
      .from("grades")
      .select("*")
      .in("student_id", studentIds)
      .order("evaluation_date", { ascending: false })
      .limit(20),
    supabase.from("student_fees").select("*").in("student_id", studentIds),
    supabase.from("student_documents").select("*").in("student_id", studentIds),
    supabase
      .from("behavior_notes")
      .select("*")
      .in("student_id", studentIds)
      .order("session_date", { ascending: false })
      .limit(10),
  ]);

  const rankMap = new Map<string, RankRow>();
  for (const r of ranks ?? []) {
    rankMap.set(r.student_id, r as RankRow);
  }

  const alertsMap = new Map<string, AlertRow["alerts"]>();
  for (const a of alertsRows ?? []) {
    alertsMap.set(a.student_id, (a as AlertRow).alerts);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Suivi de mes enfants</h1>
        <p className="text-slate-500">
          Vue d&apos;ensemble intelligente : moyennes, présences, paiements et alertes.
        </p>
      </div>

      {children.map((child: ChildSummaryRow) => (
        <ChildCard
          key={child.student_id}
          child={child}
          rank={rankMap.get(child.student_id)}
          alerts={alertsMap.get(child.student_id) ?? []}
          attendance={(attendance ?? []).filter((a) => a.student_id === child.student_id).slice(0, 10)}
          grades={(grades ?? []).filter((g) => g.student_id === child.student_id).slice(0, 10)}
          fees={(fees ?? []).filter((f) => f.student_id === child.student_id)}
          documents={(documents ?? []).filter((d) => d.student_id === child.student_id)}
          notes={(notes ?? []).filter((n) => n.student_id === child.student_id)}
        />
      ))}
    </div>
  );
}

function ChildCard({
  child,
  rank,
  alerts,
  attendance,
  grades,
  fees,
  documents,
  notes,
}: {
  child: ChildSummaryRow;
  rank: RankRow | undefined;
  alerts: AlertRow["alerts"];
  attendance: Array<{ id: string; session_date: string; present: boolean }>;
  grades: Array<{ id: string; subject: string; score: number; max_score: number; evaluation_date: string; evaluation_type: string }>;
  fees: Array<{ id: string; status: string; amount: number; amount_paid: number; due_date: string | null }>;
  documents: Array<{ id: string; doc_type: string; status: string; required: boolean }>;
  notes: Array<{ id: string; kind: string; title: string }>;
}) {
  // Recalcule via TS pour validation (et single source of truth client)
  const computedAlerts = buildParentAlerts({
    studentId: child.student_id,
    fullName: child.full_name,
    levelName: child.level_name,
    sectionName: child.section_name,
    currentAverage: child.current_average,
    gradesCount: child.grades_count_90d,
    attendancePct: child.attendance_pct_30d,
    recentAbsences: child.recent_absences,
    feesRemaining: child.fees_remaining,
    feesOverdueCount: child.fees_overdue_count,
    docsMissingCount: child.docs_missing_count,
    behaviorConcernsCount: child.behavior_concerns_count,
    hasRecentDrop: child.has_recent_drop,
    parentSatisfactionScore: child.parent_satisfaction_score,
  });

  // Le serveur fait foi, mais on préfère les alertes client si la liste serveur est vide (fallback)
  const allAlerts = alerts.length > 0 ? alerts : computedAlerts;

  const satisfactionColor =
    child.parent_satisfaction_score >= 80
      ? "text-emerald-700"
      : child.parent_satisfaction_score >= 60
      ? "text-amber-700"
      : child.parent_satisfaction_score >= 40
      ? "text-orange-700"
      : "text-red-700";

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">{child.full_name}</h2>
          <p className="text-sm text-slate-500">
            {child.level_name} — {child.section_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Score global</p>
          <p className={`text-3xl font-bold tabular-nums ${satisfactionColor}`}>
            {child.parent_satisfaction_score}/100
          </p>
        </div>
      </div>

      {/* Alertes */}
      {allAlerts.length > 0 && (
        <div className="space-y-2">
          {allAlerts.map((a, i) => {
            const typeKey = a.type as keyof typeof ALERT_ICON;
            const sevKey = a.severity as keyof typeof SEVERITY_COLOR;
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${SEVERITY_COLOR[sevKey]}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{ALERT_ICON[typeKey] ?? "ℹ️"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs">{a.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label="Moyenne"
          value={child.current_average > 0 ? `${child.current_average}/20` : "—"}
          color={
            child.current_average >= 14
              ? "text-emerald-700"
              : child.current_average >= 10
              ? "text-amber-700"
              : child.current_average > 0
              ? "text-red-700"
              : "text-slate-400"
          }
          hint={rank ? `Rang ${rank.rank_in_section}e/${rank.section_size}` : null}
        />
        <Kpi
          label="Assiduité"
          value={child.attendance_pct_30d !== null ? `${child.attendance_pct_30d}%` : "—"}
          color={
            child.attendance_pct_30d === null
              ? "text-slate-400"
              : child.attendance_pct_30d >= 90
              ? "text-emerald-700"
              : child.attendance_pct_30d >= 75
              ? "text-amber-700"
              : "text-red-700"
          }
        />
        <Kpi
          label="Restant dû"
          value={formatXof(child.fees_remaining)}
          color={child.fees_remaining > 0 ? "text-red-700" : "text-emerald-700"}
          hint={child.fees_overdue_count > 0 ? `${child.fees_overdue_count} en retard` : null}
        />
        <Kpi
          label="Docs manquants"
          value={String(child.docs_missing_count)}
          color={child.docs_missing_count > 0 ? "text-amber-700" : "text-emerald-700"}
        />
        <Kpi
          label="Absences 14j"
          value={String(child.recent_absences)}
          color={child.recent_absences >= 3 ? "text-red-700" : child.recent_absences > 0 ? "text-amber-700" : "text-emerald-700"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-navy mb-3">Assiduité (10 dernières séances)</h3>
          {attendance.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {attendance.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{new Date(a.session_date).toLocaleDateString("fr-FR")}</span>
                  <span className={a.present ? "text-emerald-700" : "text-red-700"}>
                    {a.present ? "Présent" : "Absent"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée de présence.</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-navy mb-3">Dernières notes</h3>
          <ul className="space-y-1 text-sm">
            {grades.map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {g.subject} — {new Date(g.evaluation_date).toLocaleDateString("fr-FR")}
                </span>
                <span className="font-medium tabular-nums">
                  {g.score}/{g.max_score}
                </span>
              </li>
            ))}
            {grades.length === 0 && (
              <li className="text-slate-400">Aucune note enregistrée.</li>
            )}
          </ul>
        </div>
      </div>

      {(fees.length > 0 || documents.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fees.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-navy">Frais</h3>
                <Link
                  href="/dashboard/parent/paiements"
                  className="text-sm text-amber-700 font-medium"
                >
                  Tout voir
                </Link>
              </div>
              <ul className="space-y-2 text-sm">
                {fees.slice(0, 4).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span className={feeStatusClass(f.status as "pending" | "partial" | "paid" | "overdue")}>
                      {f.status}
                    </span>
                    <span className="tabular-nums">
                      {formatXof(Number(f.amount) - Number(f.amount_paid))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {documents.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-navy">Documents</h3>
                <Link
                  href="/dashboard/parent/documents"
                  className="text-sm text-amber-700 font-medium"
                >
                  Tout voir
                </Link>
              </div>
              <ul className="space-y-1 text-sm">
                {documents.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType] ?? d.doc_type}
                    </span>
                    <span className="text-xs">
                      {DOCUMENT_STATUS_LABEL[d.status as DocumentStatus] ?? d.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-navy mb-3">Comportement (récent)</h3>
          <ul className="space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="font-medium">{n.kind}</span> — {n.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string | null;
}) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}