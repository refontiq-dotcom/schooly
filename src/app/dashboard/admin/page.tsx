import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const { supabase, profile } = await getSessionProfile();

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, student_full_name, parent_full_name, parent_phone, status, created_at")
    .eq("establishment_id", establishment?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: availability } = await supabase
    .from("level_availability")
    .select("*")
    .eq("establishment_id", establishment?.id ?? "");

  const counts = {
    reserved: reservations?.filter((r) => r.status === "reserved").length ?? 0,
    confirmed: reservations?.filter((r) => r.status === "confirmed").length ?? 0,
    pending: reservations?.filter((r) => r.status === "pending_payment").length ?? 0,
    total: reservations?.length ?? 0,
  };

  const totalCapacity = availability?.reduce((s, a) => s + a.total_capacity, 0) ?? 0;
  const totalTaken = availability?.reduce((s, a) => s + a.total_taken, 0) ?? 0;
  const fillRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">
            Bonjour Admin <span className="inline-block animate-[wave_0.5s_ease-in-out]">👋</span>
          </h1>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
            {establishment?.name ?? "Mon établissement"}
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {!establishment && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            Aucun établissement rattaché.{" "}
            <Link href="/onboarding/etablissement" className="font-semibold underline hover:text-amber-800">
              Créer un établissement
            </Link>
          </div>
        )}

        {/* Hero Card — dark gradient with main stat */}
        <div className="bg-gradient-to-br from-[#1B3A4B] via-[#1F4557] to-[#2A6B7C] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-slate-900/10">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-20 w-36 h-36 bg-white/5 rounded-full translate-y-12" />
          <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/3 rounded-full" />

          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm text-slate-300 mb-1 font-medium">Élèves inscrits</p>
              <div className="flex items-end gap-3 mb-5">
                <p className="text-5xl font-extrabold tracking-tight">{totalTaken}</p>
                <p className="text-sm text-slate-400 mb-2">/ {totalCapacity} places</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/dashboard/admin/classes"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Gérer les classes
                </Link>
                <Link
                  href="/dashboard/secretariat/scan"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                  </svg>
                  Scanner QR
                </Link>
              </div>
            </div>
            {/* Mini chart */}
            <div className="hidden sm:block opacity-40 shrink-0">
              <svg width="140" height="70" viewBox="0 0 140 70" fill="none">
                <path d="M0 60 Q15 55 25 48 T50 35 T75 30 T100 22 T125 15 T140 8" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M0 60 Q15 55 25 48 T50 35 T75 30 T100 22 T125 15 T140 8 V70 H0Z" fill="url(#heroGrad)" />
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Inscriptions"
            value={String(counts.confirmed)}
            subtitle="Confirmées"
            percentage={totalCapacity > 0 ? Math.round((counts.confirmed / totalCapacity) * 100) : 0}
            trend={"+12%"}
            bgColor="bg-[#E8F5E9]"
            accentColor="text-[#2E7D32]"
            iconBg="bg-[#C8E6C9]"
          />
          <StatCard
            title="En attente"
            value={String(counts.pending)}
            subtitle="À traiter"
            percentage={counts.total > 0 ? Math.round((counts.pending / counts.total) * 100) : 0}
            trend={counts.pending > 0 ? "⚠" : "✓"}
            bgColor="bg-[#FFF3E0]"
            accentColor="text-[#E65100]"
            iconBg="bg-[#FFE0B2]"
          />
          <StatCard
            title="Résultats"
            value={`${fillRate}%`}
            subtitle="Remplissage"
            percentage={fillRate}
            trend={fillRate > 70 ? "+hausse" : "stable"}
            bgColor="bg-[#E3F2FD]"
            accentColor="text-[#1565C0]"
            iconBg="bg-[#BBDEFB]"
          />
        </div>

        {/* Chart Section — placeholder for future chart library */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-800 text-[15px]">Tendance des inscriptions</h2>
              <p className="text-xs text-slate-400 mt-0.5">Évolution sur les 7 derniers jours</p>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">Semaine</span>
          </div>
          {/* Chart placeholder */}
          <div className="relative h-48 flex items-end">
            <svg className="w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none" fill="none">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="0" y1={i * 45} x2="600" y2={i * 45} stroke="#f1f5f9" strokeWidth="1" />
              ))}
              {/* Area fill */}
              <path d="M0 140 Q75 130 150 110 T300 80 T450 60 T600 30 V180 H0Z" fill="url(#chartGrad)" />
              {/* Line */}
              <path d="M0 140 Q75 130 150 110 T300 80 T450 60 T600 30" stroke="#E8A44A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Dots */}
              {[0, 150, 300, 450, 600].map((x, i) => {
                const y = 140 - (i * 27.5);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="4" fill="white" stroke="#E8A44A" strokeWidth="2" />
                  </g>
                );
              })}
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8A44A" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#E8A44A" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            {/* Labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 -mb-6">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <span key={d} className="text-[10px] text-slate-400">{d}</span>
              ))}
            </div>
          </div>
          <div className="mt-8" />
        </div>

        {/* Bottom Row — Quick Access + Recent Activity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quick Access */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-[15px]">Accès rapides</h3>
              <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <Link href="/dashboard/secretariat" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Secrétariat</p>
                  <p className="text-xs text-slate-400">Scanner QR codes</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link href="/dashboard/professeur" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Professeurs</p>
                  <p className="text-xs text-slate-400">Notes et présences</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link href="/dashboard/admin/classes" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Classes</p>
                  <p className="text-xs text-slate-400">Gérer les niveaux</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-[15px]">Activité récente</h3>
              <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            </div>
            {reservations && reservations.length > 0 ? (
              <div className="space-y-0.5">
                {reservations.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                      {r.student_full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.student_full_name}</p>
                      <p className="text-[11px] text-slate-400">
                        {r.parent_full_name} · {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center">Aucune activité récente</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-full xl:w-[320px] shrink-0 space-y-4">
        {/* Reservations */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-[15px]">Réservations</h3>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Mois</span>
          </div>
          {reservations && reservations.length > 0 ? (
            <div className="space-y-3">
              {reservations.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {r.student_full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{r.student_full_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">Aucune réservation</p>
          )}
        </div>

        {/* Levels Active */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-[15px]">Niveaux actifs</h3>
            <Link href="/dashboard/admin/classes" className="text-[11px] font-medium text-amber-600 hover:text-amber-500">
              Tout voir →
            </Link>
          </div>
          {availability && availability.length > 0 ? (
            <div className="space-y-3">
              {availability.slice(0, 5).map((lvl) => {
                const pct = lvl.total_capacity > 0 ? Math.round((lvl.total_taken / lvl.total_capacity) * 100) : 0;
                return (
                  <div key={lvl.level_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-slate-700">{lvl.level_name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lvl.seats_available > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {lvl.seats_available > 0 ? `${lvl.seats_available} places` : "Complet"}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{lvl.total_taken} / {lvl.total_capacity}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">
              Aucun niveau configuré
            </p>
          )}
        </div>

        {/* Quick Summary */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 text-[15px] mb-3">Résumé</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-500">Taux de remplissage</span>
              <span className="text-[13px] font-bold text-slate-800">{fillRate}%</span>
            </div>
            <div className="w-full h-px bg-slate-200/60" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-500">En attente</span>
              <span className="text-[13px] font-bold text-amber-600">{counts.pending}</span>
            </div>
            <div className="w-full h-px bg-slate-200/60" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-500">Finalisées</span>
              <span className="text-[13px] font-bold text-emerald-600">{counts.confirmed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-600",
    reserved: "bg-amber-50 text-amber-600",
    pending_payment: "bg-slate-100 text-slate-500",
    cancelled: "bg-red-50 text-red-500",
    expired: "bg-slate-100 text-slate-400",
  };
  const labels: Record<string, string> = {
    confirmed: "Confirmé",
    reserved: "Réservé",
    pending_payment: "En attente",
    cancelled: "Annulé",
    expired: "Expiré",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${styles[status] || "bg-slate-100 text-slate-500"}`}>
      {labels[status] || status}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  percentage,
  trend,
  bgColor,
  accentColor,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle: string;
  percentage: number;
  trend: string;
  bgColor: string;
  accentColor: string;
  iconBg: string;
}) {
  return (
    <div className={`${bgColor} rounded-2xl p-5 relative overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-xs font-semibold ${accentColor} uppercase tracking-wider`}>{title}</p>
        <div className={`${iconBg} w-8 h-8 rounded-xl flex items-center justify-center`}>
          <svg className={`w-4 h-4 ${accentColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
      </div>
      <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${accentColor} bg-white/60`}>
          {trend}
        </span>
      </div>
      {/* Mini sparkline */}
      <div className="absolute bottom-3 right-4 opacity-20">
        <svg width="70" height="28" viewBox="0 0 70 28" fill="none">
          <path d="M0 24 Q12 20 18 16 T36 10 T54 8 T70 2" stroke="currentColor" strokeWidth="1.5" className={accentColor} fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
