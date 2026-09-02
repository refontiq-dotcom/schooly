import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ICONS } from "@/types";
import type { SchoolType } from "@/types";

export const revalidate = 0;

/** Build the last 7 days array with labels */
function getWeekDays() {
  const days: { key: string; label: string; short: string }[] = [];
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: dayNames[d.getDay()],
      short: `${d.getDate()}/${d.getMonth() + 1}`,
    });
  }
  return days;
}

export default async function AdminDashboardPage() {
  const { supabase, profile } = await getSessionProfile();

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name, city, school_type")
        .eq("id", profile.establishment_id)
        .maybeSingle()
    : { data: null };

  const estId = establishment?.id ?? "";

  // ── Parallel queries ──
  const [reservationsRes, availabilityRes, weekRes] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, student_full_name, parent_full_name, parent_phone, status, amount_paid, created_at")
      .eq("establishment_id", estId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("level_availability")
      .select("*")
      .eq("establishment_id", estId),
    // Last 7 days of reservations
    supabase
      .from("reservations")
      .select("created_at, status")
      .eq("establishment_id", estId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true }),
  ]);

  const reservations = reservationsRes.data ?? [];
  const availability = availabilityRes.data ?? [];
  const weekData = weekRes.data ?? [];

  // ── Compute stats ──
  const counts = {
    reserved: reservations.filter((r) => r.status === "reserved").length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    pending: reservations.filter((r) => r.status === "pending_payment").length,
    total: reservations.length,
  };

  const totalCapacity = availability.reduce((s, a) => s + a.total_capacity, 0);
  const totalTaken = availability.reduce((s, a) => s + a.total_taken, 0);
  const fillRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;

  // ── Weekly trend data (reservations per day) ──
  const weekDays = getWeekDays();
  const dailyCounts = weekDays.map((day) => {
    const count = weekData.filter((r) => r.created_at.startsWith(day.key)).length;
    return { ...day, count };
  });
  const maxDaily = Math.max(...dailyCounts.map((d) => d.count), 1);

  // ── This week vs last week ──
  const thisWeekTotal = weekData.length;
  const lastWeekRes = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", estId)
    .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  const lastWeekTotal = lastWeekRes.count ?? 0;
  const weekTrend = lastWeekTotal > 0
    ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
    : thisWeekTotal > 0 ? 100 : 0;

  // ── Contextual alerts ──
  const nearFullLevels = availability.filter((a) => {
    const pct = a.total_capacity > 0 ? (a.total_taken / a.total_capacity) * 100 : 0;
    return pct >= 80;
  });

  const pendingPayments = reservations.filter((r) => r.status === "pending_payment");

  const hasData = reservations.length > 0 || availability.length > 0;

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">
              Bonjour Admin <span className="inline-block">👋</span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {establishment
                ? `${establishment.name}${establishment.city ? " · " + establishment.city : ""}`
                : "Bienvenue sur votre tableau de bord"}
            </p>
            {establishment?.school_type && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full mt-2">
                <span>{SCHOOL_TYPE_ICONS[establishment.school_type as SchoolType]}</span>
                {SCHOOL_TYPE_LABELS[establishment.school_type as SchoolType]}
              </span>
            )}
          </div>
          {establishment && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              {thisWeekTotal} réservations cette semaine
              {weekTrend !== 0 && (
                <span className={`font-semibold ${weekTrend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {weekTrend > 0 ? `+${weekTrend}%` : `${weekTrend}%`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Empty State Onboarding ── */}
        {!hasData && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {establishment ? "Bienvenue dans Schooly !" : "Commencez par créer votre établissement"}
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              {establishment
                ? "Votre tableau de bord se remplira au fur et à mesure des inscriptions. En attendant, configurez vos classes et niveaux."
                : "Pour commencer à gérer vos inscriptions et élèves, créez d'abord votre établissement."}{" "}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {!establishment && (
                <Link
                  href="/onboarding/etablissement"
                  className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Créer un établissement
                </Link>
              )}
              <Link
                href="/dashboard/admin/classes"
                className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
              >
                Configurer les classes
              </Link>
            </div>
            {/* Steps guide */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { step: "1", title: "Créer les classes", desc: "Définissez niveaux et sections" },
                { step: "2", title: "Inviter l'équipe", desc: "Professeurs et secrétariat" },
                { step: "3", title: "Recevoir les inscriptions", desc: "Les parents s'inscrivent en ligne" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-bold flex items-center justify-center mx-auto mb-2">
                    {s.step}
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{s.title}</p>
                  <p className="text-[11px] text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Contextual Alerts ── */}
        {hasData && (
          <div className="space-y-2">
            {pendingPayments.length > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    {pendingPayments.length} réservation{pendingPayments.length > 1 ? "s" : ""} en attente de paiement
                  </p>
                  <p className="text-xs text-amber-600">
                    {pendingPayments.slice(0, 2).map((p) => p.parent_full_name).join(", ")}
                    {pendingPayments.length > 2 && ` et ${pendingPayments.length - 2} autres`}
                  </p>
                </div>
                <Link
                  href="/dashboard/secretariat"
                  className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Traiter →
                </Link>
              </div>
            )}
            {nearFullLevels.length > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800">
                    {nearFullLevels.length} classe{nearFullLevels.length > 1 ? "s" : ""} presque{nearFullLevels.length === 1 ? "e" : ""} complète{nearFullLevels.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-600">
                    {nearFullLevels.map((l) => {
                      const pct = Math.round((l.total_taken / l.total_capacity) * 100);
                      return `${l.level_name} (${pct}%)`;
                    }).join(", ")}
                  </p>
                </div>
                <Link
                  href="/dashboard/admin/classes"
                  className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Voir →
                </Link>
              </div>
            )}
          </div>
        )}

        {establishment && (
          <>
            {/* ── Hero Card ── */}
            <div className="bg-gradient-to-br from-[#1B3A4B] via-[#1F4557] to-[#2A6B7C] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-slate-900/10">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-20 w-36 h-36 bg-white/5 rounded-full translate-y-12" />

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
                      className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                      </svg>
                      Scanner QR
                    </Link>
                  </div>
                </div>
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

            {/* ── 3 Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Inscriptions"
                value={String(counts.confirmed)}
                subtitle="Confirmées"
                trend={weekTrend > 0 ? `+${weekTrend}% vs semaine dernière` : weekTrend < 0 ? `${weekTrend}% vs semaine dernière` : "stable"}
                bgColor="bg-[#E8F5E9]"
                accentColor="text-[#2E7D32]"
                iconBg="bg-[#C8E6C9]"
              />
              <StatCard
                title="En attente"
                value={String(counts.pending)}
                subtitle="Paiement requis"
                trend={counts.pending > 0 ? `${counts.pending} à traiter` : "Tout est à jour"}
                bgColor="bg-[#FFF3E0]"
                accentColor="text-[#E65100]"
                iconBg="bg-[#FFE0B2]"
              />
              <StatCard
                title="Remplissage"
                value={`${fillRate}%`}
                subtitle={`${totalTaken} / ${totalCapacity} places`}
                trend={fillRate >= 90 ? "⚠ Quasi complet" : fillRate >= 70 ? "Bon taux" : "Encore de la place"}
                bgColor="bg-[#E3F2FD]"
                accentColor="text-[#1565C0]"
                iconBg="bg-[#BBDEFB]"
              />
            </div>

            {/* ── Real Weekly Trend Chart ── */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-slate-800 text-[15px]">Tendance des inscriptions</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {thisWeekTotal} cette semaine
                    {weekTrend !== 0 && (
                      <span className={`ml-1 font-semibold ${weekTrend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        ({weekTrend > 0 ? "+" : ""}{weekTrend}%)
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">7 jours</span>
              </div>
              <div className="relative h-44">
                <svg className="w-full h-full" viewBox="0 0 600 160" preserveAspectRatio="none" fill="none">
                  {[0, 1, 2, 3].map((i) => (
                    <line key={i} x1="0" y1={i * 45 + 10} x2="600" y2={i * 45 + 10} stroke="#f1f5f9" strokeWidth="1" />
                  ))}
                  {/* Area */}
                  <path
                    d={dailyCounts.map((d, i) => {
                      const x = (i / 6) * 560 + 20;
                      const y = 150 - (d.count / maxDaily) * 130;
                      return `${i === 0 ? "M" : "L"}${x} ${y}`;
                    }).join(" ") + ` L580 150 L20 150 Z`}
                    fill="url(#chartArea)"
                  />
                  {/* Line */}
                  <path
                    d={dailyCounts.map((d, i) => {
                      const x = (i / 6) * 560 + 20;
                      const y = 150 - (d.count / maxDaily) * 130;
                      return `${i === 0 ? "M" : "L"}${x} ${y}`;
                    }).join(" ")}
                    stroke="#E8A44A"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Dots */}
                  {dailyCounts.map((d, i) => {
                    const x = (i / 6) * 560 + 20;
                    const y = 150 - (d.count / maxDaily) * 130;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="5" fill="white" stroke="#E8A44A" strokeWidth="2" />
                        {d.count > 0 && (
                          <text x={x} y={y - 12} textAnchor="middle" className="fill-slate-600 text-[11px] font-semibold">
                            {d.count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <defs>
                    <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8A44A" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#E8A44A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-5">
                  {dailyCounts.map((d) => (
                    <div key={d.key} className="text-center">
                      <p className="text-[10px] font-medium text-slate-500">{d.label}</p>
                      <p className="text-[9px] text-slate-400">{d.short}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Actions Prioritaires (replaces "Accès rapides") ── */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 text-[15px]">Actions prioritaires</h3>
              </div>
              <div className="space-y-2">
                {counts.pending > 0 && (
                  <Link
                    href="/dashboard/secretariat"
                    className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100/70 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">Confirmer les paiements</p>
                      <p className="text-xs text-amber-600">{counts.pending} réservation{counts.pending > 1 ? "s" : ""} en attente</p>
                    </div>
                    <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{counts.pending}</span>
                  </Link>
                )}
                {nearFullLevels.length > 0 && (
                  <Link
                    href="/dashboard/admin/classes"
                    className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100/70 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">Vérifier les classes pleines</p>
                      <p className="text-xs text-red-600">
                        {nearFullLevels.map((l) => l.level_name).join(", ")} ≥ 80%
                      </p>
                    </div>
                  </Link>
                )}
                <Link
                  href="/dashboard/admin/classes"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Ajouter une classe</p>
                    <p className="text-xs text-slate-400">{availability.length} niveau{availability.length !== 1 ? "x" : ""} configuré{availability.length !== 1 ? "s" : ""}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
                <Link
                  href="/dashboard/admin/equipe"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Inviter du personnel</p>
                    <p className="text-xs text-slate-400">Professeurs, secrétariat</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="w-full xl:w-[320px] shrink-0 space-y-4">
        {/* Reservations */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-[15px]">Dernières réservations</h3>
          </div>
          {reservations.length > 0 ? (
            <div className="space-y-3">
              {reservations.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {r.student_full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{r.student_full_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {r.parent_full_name} · {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
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
            <h3 className="font-semibold text-slate-800 text-[15px]">Occupation par niveau</h3>
            <Link href="/dashboard/admin/classes" className="text-[11px] font-medium text-amber-600 hover:text-amber-500">
              Tout voir →
            </Link>
          </div>
          {availability.length > 0 ? (
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
              Aucun niveau configuré ·{" "}
              <Link href="/dashboard/admin/classes" className="text-amber-600 hover:underline">Ajouter</Link>
            </p>
          )}
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
  trend,
  bgColor,
  accentColor,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle: string;
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
      <div className="mt-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${accentColor} bg-white/60`}>
          {trend}
        </span>
      </div>
    </div>
  );
}
