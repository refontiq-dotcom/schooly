import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ICONS } from "@/types";
import type { SchoolType } from "@/types";
import { ConfirmReservationButton } from "./_ops-forms";
import { fetchOnboardingProgress } from "@/lib/onboarding-intelligence/scoring";
import type { OnboardingProgress } from "@/lib/onboarding-intelligence/scoring";
import LogoUpload from "./logo-upload";
import GeminiCard from "@/components/dashboard/GeminiCard";
import {
  UserCheck,
  Clock3,
  Percent,
  Wallet,
  AlertTriangle,
  Plus,
  UserPlus,
  QrCode,
  ChevronRight,
  School,
} from "lucide-react";

export const revalidate = 0;

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

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
  const { supabase, profile, user } = await getSessionProfile();
  if (!user || !supabase) {
    redirect("/auth?returnTo=/dashboard/admin");
  }

  const { data: establishment } = profile?.establishment_id
    ? await supabase
        .from("establishments")
        .select("id, name, city, school_type, published_to_trouvetou, logo_url")
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
    supabase
      .from("reservations")
      .select("created_at, status")
      .eq("establishment_id", estId)
      .gte("created_at", isoDaysAgo(7))
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

  // ── Weekly trend data ──
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
    .gte("created_at", isoDaysAgo(14))
    .lt("created_at", isoDaysAgo(7));
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

  // ── Onboarding progress ──
  const onboarding: OnboardingProgress | null = establishment
    ? await fetchOnboardingProgress(supabase, establishment.id)
    : null;
  const showOnboarding = onboarding && onboarding.completion_pct < 100;

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* ── Colonne principale ── */}
      <div className="min-w-0 flex-1 space-y-5">
        {showOnboarding && onboarding && <OnboardingAssistant data={onboarding} />}

        {/* Header de page */}
        <div className="gemini-glow relative flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="gemini-gradient-text text-2xl font-bold sm:text-[28px]">
              Bonjour {profile?.full_name?.split(" ")[0] || "Admin"} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {establishment
                ? `${establishment.name}${establishment.city ? " · " + establishment.city : ""}`
                : "Bienvenue sur votre tableau de bord"}
            </p>
            {establishment?.school_type && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                <span>{SCHOOL_TYPE_ICONS[establishment.school_type as SchoolType]}</span>
                {SCHOOL_TYPE_LABELS[establishment.school_type as SchoolType]}
              </span>
            )}
          </div>
          {establishment && (
            <div className="flex items-center gap-2 rounded-full border border-subtle bg-surface px-3.5 py-2 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-[#6ddba4]" />
              {thisWeekTotal} réservations cette semaine
              {weekTrend !== 0 && (
                <span className={`font-semibold ${weekTrend > 0 ? "text-[#6ddba4]" : "text-[#f28b82]"}`}>
                  {weekTrend > 0 ? `+${weekTrend}%` : `${weekTrend}%`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Logo upload */}
        {estId && (
          <div className="rounded-3xl border border-subtle bg-surface p-5">
            <LogoUpload
              establishmentId={estId}
              currentLogoUrl={(establishment as unknown as { logo_url: string | null })?.logo_url ?? null}
              establishmentName={establishment?.name ?? ""}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasData && (
          <div className="rounded-3xl border border-subtle bg-surface p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-hover">
              <School className="h-8 w-8 text-accent-primary" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-text">
              {establishment ? "Bienvenue dans Schooly !" : "Commencez par créer votre établissement"}
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm text-muted">
              {establishment
                ? "Votre tableau de bord se remplira au fur et à mesure des inscriptions. En attendant, configurez vos classes et niveaux."
                : "Pour commencer à gérer vos inscriptions et élèves, créez d'abord votre établissement."}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!establishment && (
                <Link
                  href="/onboarding/etablissement"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-[#062e43] transition-all duration-200 hover:brightness-110"
                >
                  <Plus className="h-4 w-4" />
                  Créer un établissement
                </Link>
              )}
              <Link
                href="/dashboard/admin/classes"
                className="inline-flex items-center gap-2 rounded-2xl border border-subtle bg-hover px-5 py-2.5 text-sm font-semibold text-accent-text transition-all duration-200 hover:bg-subtle"
              >
                Configurer les classes
              </Link>
            </div>
            <div className="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { step: "1", title: "Créer les classes", desc: "Définissez niveaux et sections" },
                { step: "2", title: "Inviter l'équipe", desc: "Professeurs et secrétariat" },
                { step: "3", title: "Recevoir les inscriptions", desc: "Les parents s'inscrivent en ligne" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent-active text-sm font-bold text-accent-text">
                    {s.step}
                  </div>
                  <p className="text-xs font-semibold text-text">{s.title}</p>
                  <p className="text-[11px] text-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Alertes contextuelles ── */}
        {hasData && (pendingPayments.length > 0 || nearFullLevels.length > 0) && (
          <div className="space-y-2">
            {pendingPayments.length > 0 && (
              <div className="flex items-center gap-3 rounded-3xl border border-[#5c420e]/60 bg-[#2b2013] px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a3213]/70">
                  <Wallet className="h-4 w-4 text-[#f2c98a]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#f2c98a]">
                    {pendingPayments.length} réservation{pendingPayments.length > 1 ? "s" : ""} en attente de paiement
                  </p>
                  <p className="text-xs text-muted">
                    {pendingPayments.slice(0, 2).map((p) => p.parent_full_name).join(", ")}
                    {pendingPayments.length > 2 && ` et ${pendingPayments.length - 2} autres`}
                  </p>
                </div>
                <Link
                  href="/dashboard/secretariat"
                  className="shrink-0 rounded-full bg-[#4a3213]/80 px-3.5 py-1.5 text-xs font-semibold text-[#f2c98a] transition-all duration-200 hover:bg-[#5c420e]"
                >
                  Traiter →
                </Link>
              </div>
            )}
            {nearFullLevels.length > 0 && (
              <div className="flex items-center gap-3 rounded-3xl border border-[#5f2120]/60 bg-[#2d1a1a] px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a2626]/70">
                  <AlertTriangle className="h-4 w-4 text-[#f28b82]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#f28b82]">
                    {nearFullLevels.length} classe{nearFullLevels.length > 1 ? "s" : ""} presque{nearFullLevels.length === 1 ? "e" : ""} complète{nearFullLevels.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {nearFullLevels.map((l) => {
                      const pct = Math.round((l.total_taken / l.total_capacity) * 100);
                      return `${l.level_name} (${pct}%)`;
                    }).join(", ")}
                  </p>
                </div>
                <Link
                  href="/dashboard/admin/classes"
                  className="shrink-0 rounded-full bg-[#4a2626]/80 px-3.5 py-1.5 text-xs font-semibold text-[#f28b82] transition-all duration-200 hover:bg-[#5f2120]"
                >
                  Voir →
                </Link>
              </div>
            )}
          </div>
        )}

        {establishment && (
          <>
            {/* ── Hero card ── */}
            <div className="relative overflow-hidden rounded-3xl border border-accent-primary/20 bg-gradient-to-br from-[#004a77] via-[#0b3d63] to-[#131314] p-6 sm:p-8">
              <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-accent-primary/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-[#a8c7fa]/5 blur-2xl" />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-1 text-sm font-medium text-muted">Élèves inscrits</p>
                  <div className="mb-5 flex items-end gap-3">
                    <p className="text-5xl font-bold tracking-tight text-text tabular-nums">{totalTaken}</p>
                    <p className="mb-2 text-sm text-muted">/ {totalCapacity} places</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/admin/classes"
                      className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-[#062e43] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Gérer les classes
                    </Link>
                    <Link
                      href="/dashboard/secretariat/scan"
                      className="inline-flex items-center gap-2 rounded-2xl border border-subtle bg-hover px-5 py-2.5 text-sm font-medium text-text transition-all duration-200 hover:bg-subtle"
                    >
                      <QrCode className="h-4 w-4" />
                      Scanner QR
                    </Link>
                  </div>
                </div>
                <div className="hidden shrink-0 opacity-50 sm:block" aria-hidden="true">
                  <svg width="150" height="72" viewBox="0 0 150 72" fill="none">
                    <path d="M0 62 Q18 56 28 48 T55 35 T82 29 T108 21 T132 14 T150 8" stroke="#a8c7fa" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M0 62 Q18 56 28 48 T55 35 T82 29 T108 21 T132 14 T150 8 V72 H0Z" fill="url(#heroGrad)" />
                    <defs>
                      <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a8c7fa" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#a8c7fa" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* ── 3 cartes de stats ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <GeminiCard
                title="Inscriptions confirmées"
                value={String(counts.confirmed)}
                subtitle="Semaine en cours"
                badge={weekTrend > 0 ? `+${weekTrend}%` : weekTrend < 0 ? `${weekTrend}%` : "stable"}
                status="positive"
                icon={UserCheck}
              />
              <GeminiCard
                title="En attente de paiement"
                value={String(counts.pending)}
                subtitle={counts.pending > 0 ? "À traiter au secrétariat" : "Tout est à jour"}
                badge={counts.pending > 0 ? `${counts.pending} à traiter` : "OK"}
                status={counts.pending > 0 ? "warning" : "neutral"}
                icon={Clock3}
              />
              <GeminiCard
                title="Taux de remplissage"
                value={`${fillRate}%`}
                subtitle={`${totalTaken} / ${totalCapacity} places`}
                badge={fillRate >= 90 ? "Quasi complet" : fillRate >= 70 ? "Bon taux" : "Place disponible"}
                status={fillRate >= 70 ? "positive" : "neutral"}
                icon={Percent}
              />
            </div>

            {/* ── Tendance hebdo ── */}
            <div className="rounded-3xl border border-subtle bg-surface p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-text">Tendance des inscriptions</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {thisWeekTotal} cette semaine
                    {weekTrend !== 0 && (
                      <span className={`ml-1 font-semibold ${weekTrend > 0 ? "text-[#6ddba4]" : "text-[#f28b82]"}`}>
                        ({weekTrend > 0 ? "+" : ""}{weekTrend}%)
                      </span>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-hover px-3 py-1.5 text-xs font-medium text-muted">7 jours</span>
              </div>
              <div className="relative h-44">
                <svg className="h-full w-full" viewBox="0 0 600 160" preserveAspectRatio="none" fill="none">
                  {[0, 1, 2, 3].map((i) => (
                    <line key={i} x1="0" y1={i * 45 + 10} x2="600" y2={i * 45 + 10} stroke="#2d2f31" strokeWidth="1" />
                  ))}
                  <path
                    d={dailyCounts.map((d, i) => {
                      const x = (i / 6) * 560 + 20;
                      const y = 150 - (d.count / maxDaily) * 130;
                      return `${i === 0 ? "M" : "L"}${x} ${y}`;
                    }).join(" ") + " L580 150 L20 150 Z"}
                    fill="url(#chartArea)"
                  />
                  <path
                    d={dailyCounts.map((d, i) => {
                      const x = (i / 6) * 560 + 20;
                      const y = 150 - (d.count / maxDaily) * 130;
                      return `${i === 0 ? "M" : "L"}${x} ${y}`;
                    }).join(" ")}
                    stroke="#a8c7fa"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {dailyCounts.map((d, i) => {
                    const x = (i / 6) * 560 + 20;
                    const y = 150 - (d.count / maxDaily) * 130;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="5" fill="#1e1f20" stroke="#a8c7fa" strokeWidth="2" />
                        {d.count > 0 && (
                          <text x={x} y={y - 12} textAnchor="middle" className="fill-[#a8c7fa] text-[11px] font-semibold">
                            {d.count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <defs>
                    <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a8c7fa" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#a8c7fa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-5">
                  {dailyCounts.map((d) => (
                    <div key={d.key} className="text-center">
                      <p className="text-[10px] font-medium text-muted">{d.label}</p>
                      <p className="text-[9px] text-muted/70">{d.short}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Actions prioritaires ── */}
            <div className="rounded-3xl border border-subtle bg-surface p-5">
              <h3 className="mb-4 text-[15px] font-semibold text-text">Actions prioritaires</h3>
              <div className="space-y-2">
                {counts.pending > 0 && (
                  <Link
                    href="/dashboard/secretariat"
                    className="flex items-center gap-3 rounded-2xl border border-[#5c420e]/50 bg-[#2b2013] p-3 transition-all duration-200 hover:border-[#f2c98a]/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4a3213]/70">
                      <Wallet className="h-5 w-5 text-[#f2c98a]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">Confirmer les paiements</p>
                      <p className="text-xs text-muted">{counts.pending} réservation{counts.pending > 1 ? "s" : ""} en attente</p>
                    </div>
                    <span className="rounded-full bg-[#4a3213] px-2.5 py-1 text-xs font-bold text-[#f2c98a]">{counts.pending}</span>
                  </Link>
                )}
                {nearFullLevels.length > 0 && (
                  <Link
                    href="/dashboard/admin/classes"
                    className="flex items-center gap-3 rounded-2xl border border-[#5f2120]/50 bg-[#2d1a1a] p-3 transition-all duration-200 hover:border-[#f28b82]/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4a2626]/70">
                      <AlertTriangle className="h-5 w-5 text-[#f28b82]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">Vérifier les classes pleines</p>
                      <p className="text-xs text-muted">
                        {nearFullLevels.map((l) => l.level_name).join(", ")} ≥ 80%
                      </p>
                    </div>
                  </Link>
                )}
                <Link
                  href="/dashboard/admin/classes"
                  className="group flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 hover:bg-hover"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hover text-accent-primary transition-colors duration-200 group-hover:bg-subtle">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">Ajouter une classe</p>
                    <p className="text-xs text-muted">{availability.length} niveau{availability.length !== 1 ? "x" : ""} configuré{availability.length !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard/admin/equipe"
                  className="group flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 hover:bg-hover"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hover text-accent-primary transition-colors duration-200 group-hover:bg-subtle">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">Inviter du personnel</p>
                    <p className="text-xs text-muted">Professeurs, secrétariat</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Panneau droit ── */}
      <div className="w-full shrink-0 space-y-4 xl:w-[320px]">
        {/* Dernières réservations */}
        <div className="rounded-3xl border border-subtle bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-text">Dernières réservations</h3>
          </div>
          {reservations.length > 0 ? (
            <div className="space-y-3">
              {reservations.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-active text-xs font-bold text-accent-text">
                    {r.student_full_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text">{r.student_full_name}</p>
                    <p className="text-[11px] text-muted">
                      {r.parent_full_name} · {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                  {r.status === "reserved" && <ConfirmReservationButton id={r.id} />}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Aucune réservation</p>
          )}
        </div>

        {/* Occupation par niveau */}
        <div className="rounded-3xl border border-subtle bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-text">Occupation par niveau</h3>
            <Link href="/dashboard/admin/classes" className="text-[11px] font-medium text-accent-primary transition-all duration-200 hover:text-[#c2e7ff]">
              Tout voir →
            </Link>
          </div>
          {availability.length > 0 ? (
            <div className="space-y-3">
              {availability.slice(0, 5).map((lvl) => {
                const pct = lvl.total_capacity > 0 ? Math.round((lvl.total_taken / lvl.total_capacity) * 100) : 0;
                return (
                  <div key={lvl.level_id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-text">{lvl.level_name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lvl.seats_available > 0 ? "bg-[#0f3d2e]/60 text-[#6ddba4]" : "bg-[#4a2626]/60 text-[#f28b82]"}`}>
                        {lvl.seats_available > 0 ? `${lvl.seats_available} places` : "Complet"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${pct >= 90 ? "bg-[#f28b82]" : pct >= 70 ? "bg-[#f2c98a]" : "bg-[#6ddba4]"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{lvl.total_taken} / {lvl.total_capacity}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              Aucun niveau configuré ·{" "}
              <Link href="/dashboard/admin/classes" className="text-accent-primary hover:underline">Ajouter</Link>
            </p>
          )}
        </div>

        {/* Opérations */}
        <div className="rounded-3xl border border-subtle bg-surface p-5">
          <h3 className="mb-3 text-[15px] font-semibold text-text">Opérations</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard/admin/paiements", title: "Paiements", sub: "Mobile Money" },
              { href: "/dashboard/admin/rentree", title: "Rentrée", sub: "Fournitures" },
              { href: "/dashboard/admin/documents", title: "Documents", sub: "Dossiers" },
              { href: "/dashboard/admin/messages", title: "Messages", sub: "Parents" },
            ].map((op) => (
              <Link
                key={op.href}
                href={op.href}
                className="rounded-2xl border border-subtle p-3 transition-all duration-200 hover:bg-hover hover:border-accent-primary/30"
              >
                <p className="text-[13px] font-medium text-text">{op.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">{op.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-[#0f3d2e]/60 text-[#6ddba4]",
    reserved: "bg-[#4a3213]/60 text-[#f2c98a]",
    pending_payment: "bg-hover text-muted",
    cancelled: "bg-[#4a2626]/60 text-[#f28b82]",
    expired: "bg-hover text-muted/70",
  };
  const labels: Record<string, string> = {
    confirmed: "Confirmé",
    reserved: "Réservé",
    pending_payment: "En attente",
    cancelled: "Annulé",
    expired: "Expiré",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status] || "bg-hover text-muted"}`}>
      {labels[status] || status}
    </span>
  );
}

// ============================================================================
// Onboarding Assistant — bandeau de progression pour l'admin
// ============================================================================
function OnboardingAssistant({ data }: { data: OnboardingProgress }) {
  const steps: { key: keyof OnboardingProgress; label: string; href: string }[] = [
    { key: "has_description", label: "Description", href: "/onboarding/etablissement" },
    { key: "has_cover", label: "Image de couverture", href: "/onboarding/etablissement" },
    { key: "has_tour", label: "Visite 360°", href: "/onboarding/etablissement" },
    { key: "has_fee_config", label: "Frais de réservation", href: "/dashboard/admin/classes" },
    { key: "has_levels", label: "Niveaux créés", href: "/dashboard/admin/classes" },
    { key: "has_sections", label: "Sections créées", href: "/dashboard/admin/classes" },
    { key: "has_teachers", label: "Professeurs invités", href: "/dashboard/admin/equipe" },
    { key: "has_staff", label: "Secrétariat", href: "/dashboard/admin/equipe" },
    { key: "has_students", label: "Élèves ajoutés", href: "/dashboard/admin/classes" },
    { key: "is_published", label: "Publié sur Trouvetou", href: "/dashboard/admin/trouvetou" },
  ];

  const completed = steps.filter((s) => data[s.key] === 1).length;
  const remaining = steps.filter((s) => data[s.key] === 0);
  const next = remaining[0];
  const pct = data.completion_pct;

  return (
    <div className="rounded-3xl border border-accent-primary/25 bg-gradient-to-br from-[#1b2735] to-[#1e1f20] p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-primary">
            Configuration de l&apos;établissement
          </p>
          <h2 className="mt-1 text-lg font-bold text-text">
            {completed === 0
              ? "Bienvenue ! Configurons votre école 🚀"
              : pct >= 75
              ? "Bientôt prêt ! 🎉"
              : "Encore quelques étapes"}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{data.next_step}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums text-text">{pct}%</p>
          <p className="text-xs text-muted">{completed}/{data.steps_total} étapes</p>
        </div>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-hover">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7cacf8] to-[#a8c7fa] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((s) => {
          const done = data[s.key] === 1;
          const isNext = s.key === next?.key;
          return (
            <Link
              key={s.key}
              href={s.href}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200 ${
                done
                  ? "bg-accent-active text-accent-text"
                  : isNext
                  ? "bg-accent-primary/15 text-accent-text ring-1 ring-accent-primary/60 hover:bg-accent-primary/25"
                  : "bg-hover text-muted hover:bg-subtle hover:text-text"
              }`}
            >
              <span className="leading-none" aria-hidden="true">
                {done ? "✅" : isNext ? "👉" : "⭕"}
              </span>
              <span className="truncate">{s.label}</span>
            </Link>
          );
        })}
      </div>

      {next && (
        <div className="mt-4 flex justify-end">
          <Link
            href={next.href}
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-4 py-2 text-sm font-semibold text-[#062e43] transition-all duration-200 hover:brightness-110"
          >
            Faire : {next.label}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
