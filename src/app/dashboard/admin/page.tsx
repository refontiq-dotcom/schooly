import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: establishments } = await supabase.from("establishments").select("id, name").limit(1);
  const establishment = establishments?.[0];

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, student_full_name, parent_full_name, parent_phone, status, created_at")
    .eq("establishment_id", establishment?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: availability } = await supabase
    .from("level_availability")
    .select("*")
    .eq("establishment_id", establishment?.id ?? "");

  const counts = {
    reserved: reservations?.filter((r) => r.status === "reserved").length ?? 0,
    confirmed: reservations?.filter((r) => r.status === "confirmed").length ?? 0,
    pending: reservations?.filter((r) => r.status === "pending_payment").length ?? 0,
  };

  const totalCapacity = availability?.reduce((s, a) => s + a.total_capacity, 0) ?? 0;
  const totalTaken = availability?.reduce((s, a) => s + a.total_taken, 0) ?? 0;
  const fillRate = totalCapacity > 0 ? Math.round((totalTaken / totalCapacity) * 100) : 0;

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Bonjour Admin 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {establishment ? establishment.name : "Tableau de bord de votre établissement"}
          </p>
        </div>

        {/* Hero stat card */}
        <div className="bg-gradient-to-br from-[#1B3A4B] to-[#2A6B7C] rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 left-20 w-32 h-32 bg-white/5 rounded-full translate-y-10" />
          <div className="relative">
            <p className="text-sm text-slate-200 mb-1">Élèves inscrits</p>
            <div className="flex items-end gap-3 mb-4">
              <p className="text-4xl font-extrabold">{totalTaken}</p>
              <p className="text-sm text-slate-300 mb-1">/ {totalCapacity} places</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/admin/classes"
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                📚 Gérer les classes
              </Link>
              <Link
                href="/dashboard/secretariat/scan"
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                📷 Scanner QR
              </Link>
            </div>
          </div>
          {/* Mini chart placeholder */}
          <div className="absolute right-6 top-6 opacity-30">
            <svg width="100" height="50" viewBox="0 0 100 50" fill="none">
              <path d="M0 40 Q20 35 30 30 T50 20 T70 25 T100 10" stroke="white" strokeWidth="2" fill="none" />
              <path d="M0 40 Q20 35 30 30 T50 20 T70 25 T100 10 V50 H0Z" fill="white" opacity="0.1" />
            </svg>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Remplissage"
            value={`${fillRate}%`}
            subtitle={`${totalTaken} / ${totalCapacity} places`}
            color="emerald"
            trend={fillRate > 50 ? "+hausse" : "stable"}
          />
          <StatCard
            title="En attente"
            value={String(counts.pending)}
            subtitle="Réservations en cours"
            color="amber"
            trend={counts.pending > 0 ? "à traiter" : "rien"}
          />
          <StatCard
            title="Finalisées"
            value={String(counts.confirmed)}
            subtitle="Inscriptions complètes"
            color="blue"
            trend={counts.confirmed > 0 ? "terminé" : "—"}
          />
        </div>

        {/* Availability by level */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Disponibilité par niveau</h2>
            <Link href="/dashboard/admin/classes" className="text-sm text-amber-600 hover:text-amber-500 font-medium">
              Tout voir →
            </Link>
          </div>
          {availability && availability.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availability.map((lvl) => {
                const pct = lvl.total_capacity > 0 ? Math.round((lvl.total_taken / lvl.total_capacity) * 100) : 0;
                return (
                  <div key={lvl.level_id} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-700 text-sm">{lvl.level_name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lvl.seats_available > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {lvl.seats_available > 0 ? `${lvl.seats_available} places` : "Complet"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">{lvl.total_taken} / {lvl.total_capacity}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aucun niveau configuré.{" "}
              <Link href="/dashboard/admin/classes" className="text-amber-600 hover:underline">
                Ajouter des classes
              </Link>
            </p>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/secretariat"
            className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg group-hover:bg-amber-100 transition-colors">
                🧾
              </span>
              <h3 className="font-semibold text-slate-800">Espace Secrétariat</h3>
            </div>
            <p className="text-sm text-slate-500">Scanner les QR codes et finaliser les inscriptions.</p>
          </Link>
          <Link
            href="/dashboard/professeur"
            className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg group-hover:bg-blue-100 transition-colors">
                🧑‍🏫
              </span>
              <h3 className="font-semibold text-slate-800">Espace Professeur</h3>
            </div>
            <p className="text-sm text-slate-500">Présences, notes et suivi des classes.</p>
          </Link>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-full xl:w-80 shrink-0 space-y-4">
        {/* Recent reservations */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">Réservations récentes</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Mois</span>
          </div>
          {reservations && reservations.length > 0 ? (
            <div className="space-y-3">
              {reservations.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-xs font-bold text-slate-600">
                    {r.student_full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.student_full_name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    r.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                    r.status === "reserved" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {r.status === "confirmed" ? "Confirmé" : r.status === "reserved" ? "Réservé" : "En attente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Aucune réservation</p>
          )}
        </div>

        {/* Niveaux rapides */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">Niveaux actifs</h3>
          {availability && availability.length > 0 ? (
            <div className="space-y-2">
              {availability.slice(0, 5).map((lvl) => (
                <div key={lvl.level_id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{lvl.level_name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${lvl.total_capacity > 0 ? Math.min((lvl.total_taken / lvl.total_capacity) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{lvl.total_taken}/{lvl.total_capacity}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Aucun niveau</p>
          )}
        </div>

        {/* Stats mini */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200/50 p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Résumé rapide</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Taux de remplissage</span>
              <span className="text-sm font-bold text-slate-800">{fillRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Réservations en attente</span>
              <span className="text-sm font-bold text-amber-600">{counts.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Inscriptions finalisées</span>
              <span className="text-sm font-bold text-emerald-600">{counts.confirmed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "emerald" | "amber" | "blue";
  trend: string;
}) {
  const colors = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", trend: "text-emerald-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", trend: "text-amber-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", trend: "text-blue-600" },
  };
  const c = colors[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-slate-50 to-transparent rounded-bl-full" />
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-3xl font-extrabold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      <div className="flex items-center gap-1 mt-2">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${c.bg} ${c.trend}`}>
          {trend}
        </span>
      </div>
      {/* Mini sparkline */}
      <div className="absolute bottom-3 right-4 opacity-20">
        <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
          <path d="M0 20 Q10 18 15 14 T30 10 T45 12 T60 4" stroke="currentColor" strokeWidth="1.5" className={c.text} fill="none" />
        </svg>
      </div>
    </div>
  );
}
