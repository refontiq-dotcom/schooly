import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { findParentStudents, groupByEstablishment, resolveEstablishmentId } from "@/lib/parent/context";
import { formatXof } from "@/lib/operations/labels";
import ParentAudio, { SpeakableCard } from "@/components/parent-audio";
import ParentNotifications from "@/components/parent-notifications";
import { INSCRIPTION_MODALITY_LABELS, INSCRIPTION_MODALITY_ICONS } from "@/types";
import type { InscriptionModality } from "@/types";

export const revalidate = 0;

/* ── Status colors ─────────────────────────────────────────────── */
function statusColor(rate: number | null): { bg: string; text: string; ring: string } {
  if (rate === null) return { bg: "bg-slate-100", text: "text-slate-400", ring: "ring-slate-200" };
  if (rate >= 80) return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (rate >= 60) return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
  return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
}

function feeColor(remaining: number): { bg: string; text: string } {
  if (remaining <= 0) return { bg: "bg-emerald-50", text: "text-emerald-700" };
  return { bg: "bg-amber-50", text: "text-amber-700" };
}

function docColor(missing: number): { bg: string; text: string } {
  if (missing === 0) return { bg: "bg-emerald-50", text: "text-emerald-700" };
  return { bg: "bg-red-50", text: "text-red-700" };
}

/* ── Attendance dots ───────────────────────────────────────────── */
function AttendanceDots({ records }: { records: { present: boolean; session_date: string }[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap" aria-label="Présences récentes">
      {records.map((r, i) => (
        <div
          key={i}
          title={`${new Date(r.session_date).toLocaleDateString("fr-FR")} — ${r.present ? "Présent" : "Absent"}`}
          className={`w-5 h-5 rounded-full ring-1 ${r.present ? "bg-emerald-400 ring-emerald-300" : "bg-red-400 ring-red-300"} transition-transform hover:scale-125`}
        />
      ))}
    </div>
  );
}

/* ── Simple grade indicator ────────────────────────────────────── */
function GradeIndicator({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  let emoji = "📝";
  let color = "bg-slate-100 text-slate-500";
  if (pct >= 80) { emoji = "🌟"; color = "bg-emerald-50 text-emerald-700"; }
  else if (pct >= 50) { emoji = "👍"; color = "bg-amber-50 text-amber-700"; }
  else { emoji = "⚠️"; color = "bg-red-50 text-red-700"; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-bold ${color}`}>
      {emoji} {score}/{max}
    </span>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ estab?: string; student?: string }>;
}) {
  const { supabase, user } = await getSessionProfile();
  if (!user || !supabase) redirect("/auth?returnTo=/dashboard/parent");

  const params = await searchParams;
  const students = await findParentStudents(supabase, user.id);
  const groups = groupByEstablishment(students);
  const selectedEstabId = resolveEstablishmentId(groups, params.estab ?? null);

  const selectedGroup = groups.find((g) => g.establishment.id === selectedEstabId);
  const currentStudents = selectedGroup?.students ?? [];
  const selectedStudentId = params.student ?? currentStudents[0]?.id ?? null;
  const student = currentStudents.find((s) => s.id === selectedStudentId) ?? currentStudents[0];

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-6xl">🏫</div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Bienvenue !</h1>
          <p className="text-slate-500 max-w-sm">
            Aucun enfant rattaché à votre compte. Contactez votre établissement pour finaliser l&apos;inscription.
          </p>
        </div>
      </div>
    );
  }

  /* ── Fetch data ─────────────────────────────────────────────── */
  const [{ data: attendance }, { data: grades }, { data: fees }, { data: documents }, { data: reservation }, { data: inscriptionFee }] =
    await Promise.all([
      supabase
        .from("attendance_records")
        .select("present, session_date")
        .eq("student_id", student.id)
        .order("session_date", { ascending: false })
        .limit(10),
      supabase
        .from("grades")
        .select("score, max_score, subject")
        .eq("student_id", student.id)
        .order("evaluation_date", { ascending: false })
        .limit(5),
      supabase.from("student_fees").select("amount, amount_paid, status").eq("student_id", student.id),
      supabase.from("student_documents").select("required, status").eq("student_id", student.id),
      // Récupérer la réservation pour la modalité
      supabase.from("reservations").select("modality, establishment_id").eq("id", student.reservation_id ?? "").maybeSingle(),
      // Frais d'inscription
      supabase.from("fee_categories").select("id, name, amount").eq("establishment_id", selectedGroup?.establishment.id ?? "").ilike("name", "%inscription%").maybeSingle(),
    ]);

  // Config modalité
  let modalityConfig: { modality: string; fee_multiplier: number; name: string }[] | null = null;
  if (selectedGroup) {
    const { data } = await supabase.from("inscription_modalities").select("modality, fee_multiplier, name").eq("establishment_id", selectedGroup.establishment.id).eq("is_active", true);
    modalityConfig = data;
  }

  /* ── Compute inscription fee ───────────────────────────────── */
  const studentModality = (reservation?.modality as InscriptionModality) ?? "standard";
  const modalityMultiplier = modalityConfig?.find((m: { modality: string; fee_multiplier: number }) => m.modality === studentModality)?.fee_multiplier ?? 1.0;
  const baseInscriptionFee = inscriptionFee?.amount ?? 0;
  const inscriptionFeeAmount = Math.round(baseInscriptionFee * modalityMultiplier * 100) / 100;

  /* ── Compute stats ──────────────────────────────────────────── */
  const presentCount = attendance?.filter((a) => a.present).length ?? 0;
  const totalCount = attendance?.length ?? 0;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;
  const remaining = (fees ?? []).reduce((s, f) => s + Number(f.amount) - Number(f.amount_paid), 0);
  const missingDocs = (documents ?? []).filter((d) => d.required && d.status === "missing").length;
  const avgGrade = (grades ?? []).length > 0
    ? Math.round((grades!.reduce((s, g) => s + (Number(g.score) / Number(g.max_score)) * 100, 0)) / grades!.length)
    : null;

  const hasAlert = remaining > 0 || missingDocs > 0 || (attendanceRate !== null && attendanceRate < 60);

  const attColors = statusColor(attendanceRate);
  const feeColors = feeColor(remaining);
  const docColors = docColor(missingDocs);

  function buildHref(path: string) {
    const p = new URLSearchParams();
    if (selectedEstabId) p.set("estab", selectedEstabId);
    if (selectedStudentId) p.set("student", selectedStudentId);
    const qs = p.toString();
    return qs ? `${path}?${qs}` : path;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* ── Child hero card ───────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
            {student.full_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-800 truncate">{student.full_name}</h1>
            {selectedGroup && (
              <p className="text-sm text-slate-500 truncate">
                📍 {selectedGroup.establishment.name}
              </p>
            )}
          </div>
          <ParentAudio
            data={{
              studentName: student.full_name,
              attendanceRate,
              averageGrade: avgGrade,
              remainingPayment: remaining,
              missingDocs,
              hasAlerts: hasAlert,
            }}
          />
          <ParentNotifications
            studentName={student.full_name}
            attendanceRate={attendanceRate}
            missingPayments={remaining > 0 ? 1 : 0}
            missingDocs={missingDocs}
            unreadMessages={0}
          />
        </div>
      </div>

      {/* ── Alert banner ─────────────────────────────────────── */}
      {hasAlert && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-3xl">🚨</span>
          <div className="text-sm text-red-800">
            {remaining > 0 && <p className="font-semibold">💰 Frais en attente</p>}
            {missingDocs > 0 && <p className="font-semibold">📄 Documents manquants</p>}
            {(attendanceRate !== null && attendanceRate < 60) && <p className="font-semibold">⚠️ Absences fréquentes</p>}
          </div>
        </div>
      )}

      {/* ── Status cards — visual grid ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Attendance */}
        <SpeakableCard
          text={`Présence. ${attendanceRate !== null ? `${attendanceRate} pour cent de présence.` : "Pas encore de données."}`}
          emoji="📋"
          label="Présence"
        >
        <div className={`rounded-2xl p-5 ${attColors.bg} border ${attColors.ring} transition-transform active:scale-95 block`}>
          <div className="text-3xl mb-2">📋</div>
          <p className={`text-3xl font-bold ${attColors.text}`}>
            {attendanceRate !== null ? `${attendanceRate}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Présence</p>
          {attendance && attendance.length > 0 && (
            <div className="mt-3">
              <AttendanceDots records={attendance} />
            </div>
          )}
        </div>
        </SpeakableCard>

        {/* Grades */}
        <div className="rounded-2xl p-5 bg-blue-50 border border-blue-100">
          <div className="text-3xl mb-2">📝</div>
          <p className="text-3xl font-bold text-blue-700">
            {avgGrade !== null ? `${avgGrade}/20` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Moyenne</p>
          {grades && grades.length > 0 && (
            <div className="mt-2 space-y-1">
              {grades.slice(0, 3).map((g, i) => (
                <div key={i} className="text-xs">
                  <GradeIndicator score={Number(g.score)} max={Number(g.max_score)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <Link href={buildHref("/dashboard/parent/paiements")} className={`rounded-2xl p-5 ${feeColors.bg} border border-slate-100 transition-transform active:scale-95`}>
          <div className="text-3xl mb-2">💰</div>
          <p className={`text-2xl font-bold ${feeColors.text}`}>
            {formatXof(remaining)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Reste à payer</p>
          {remaining === 0 && <p className="text-xs text-emerald-600 mt-1 font-medium">✅ À jour</p>}
        </Link>

        {/* Documents */}
        <Link href={buildHref("/dashboard/parent/documents")} className={`rounded-2xl p-5 ${docColors.bg} border border-slate-100 transition-transform active:scale-95`}>
          <div className="text-3xl mb-2">📄</div>
          <p className={`text-2xl font-bold ${docColors.text}`}>
            {missingDocs === 0 ? "✅" : `${missingDocs} ❌`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Documents</p>
          {missingDocs === 0 && <p className="text-xs text-emerald-600 mt-1 font-medium">Complet</p>}
        </Link>
      </div>

      {/* ── Inscription fee summary ──────────────────────────── */}
      {inscriptionFeeAmount > 0 && (
        <Link href={buildHref("/dashboard/parent/paiements")} className="block">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 transition-transform active:scale-95">
            <span className="text-3xl shrink-0">{INSCRIPTION_MODALITY_ICONS[studentModality]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Frais d&apos;inscription</p>
              <p className="text-xs text-slate-500 truncate">
                {INSCRIPTION_MODALITY_LABELS[studentModality]}
                {modalityMultiplier < 1 && (
                  <span className="text-emerald-600 ml-1">({Math.round(modalityMultiplier * 100)}%)</span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-amber-700">{formatXof(inscriptionFeeAmount)}</p>
              <p className="text-xs text-amber-600">À payer</p>
            </div>
          </div>
        </Link>
      )}

      {/* ── Quick actions ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href={buildHref("/dashboard/parent/paiements")}
          className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 p-4 hover:border-amber-300 hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-2xl">💳</span>
          <span className="text-xs font-medium text-slate-600">Payer</span>
        </Link>
        <Link
          href={buildHref("/dashboard/parent/messages")}
          className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 p-4 hover:border-amber-300 hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-2xl">💬</span>
          <span className="text-xs font-medium text-slate-600">Écrire</span>
        </Link>
        <Link
          href={buildHref("/dashboard/parent/rentree")}
          className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 p-4 hover:border-amber-300 hover:shadow-md transition-all active:scale-95"
        >
          <span className="text-2xl">🎒</span>
          <span className="text-xs font-medium text-slate-600">Rentrée</span>
        </Link>
      </div>

      {/* ── Recent attendance list ────────────────────────────── */}
      {attendance && attendance.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            📋 Présences récentes
          </h2>
          <div className="space-y-2">
            {attendance.slice(0, 7).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-500">
                  {new Date(a.session_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className={`text-lg ${a.present ? "text-emerald-500" : "text-red-500"}`}>
                  {a.present ? "✅" : "❌"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent grades list ────────────────────────────────── */}
      {grades && grades.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            📝 Dernières notes
          </h2>
          <div className="space-y-2">
            {grades.map((g, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-600 truncate mr-2">{g.subject}</span>
                <GradeIndicator score={Number(g.score)} max={Number(g.max_score)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Behavior notes ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          ⭐ Comportement
        </h2>
        <div className="text-center py-4">
          <span className="text-4xl">🌟</span>
          <p className="text-sm text-slate-500 mt-2">Tout va bien !</p>
        </div>
      </div>
    </div>
  );
}
