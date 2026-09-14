"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  fetchInternatDashboard,
  fetchStudentsAtRisk,
  fetchOccupancyTrends,
  isDashboardCritical,
} from "@/lib/internat-intelligence/scoring";
import type {
  InternatDashboardRow,
  InternatStudentAtRisk,
  InternatOccupancyTrendRow,
} from "@/lib/internat-intelligence/scoring";

export default function InternatOverviewPage() {
  const [dashboard, setDashboard] = useState<InternatDashboardRow | null>(null);
  const [studentsAtRisk, setStudentsAtRisk] = useState<InternatStudentAtRisk[]>([]);
  const [trends, setTrends] = useState<InternatOccupancyTrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("establishment_id")
      .eq("id", user.id)
      .single();

    if (!profile?.establishment_id) {
      setLoading(false);
      return;
    }

    const estId = profile.establishment_id;

    const [dash, atRisk, tr] = await Promise.all([
      fetchInternatDashboard(supabase, estId),
      fetchStudentsAtRisk(supabase, estId),
      fetchOccupancyTrends(supabase, estId),
    ]);

    setDashboard(dash);
    setStudentsAtRisk(atRisk.slice(0, 5));
    setTrends(tr);
    setLoading(false);
  }

  const totalBeds = dashboard?.total_beds ?? 0;
  const occupied = dashboard?.occupied_beds ?? 0;
  const free = dashboard?.free_beds ?? 0;
  const occupancyRate = dashboard?.occupancy_rate_pct ?? 0;
  const critical = dashboard ? isDashboardCritical(dashboard) : false;
  const criticalStudents = studentsAtRisk.filter((s) => s.risk_level === "critical");
  const highStudents = studentsAtRisk.filter((s) => s.risk_level === "high");

  // Sparkline trend (90j)
  const sparkData = trends.slice(-30);
  const sparkMax = Math.max(1, ...sparkData.map((t) => t.occupied_beds));
  const sparkPath = sparkData
    .map((t, i) => {
      const x = (i / Math.max(1, sparkData.length - 1)) * 100;
      const y = 100 - (t.occupied_beds / sparkMax) * 100;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏠 Internat</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vue d&apos;ensemble temps réel · {dashboard?.establishment_name ?? "Établissement"}
          </p>
        </div>
        <Link
          href="/dashboard/admin/internat/batiments"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Gérer les bâtiments
        </Link>
      </div>

      {/* Alerte critique */}
      {critical && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl">🚨</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {dashboard?.grave_open_incidents} incident(s) grave(s) non résolu(s)
            </p>
            <p className="text-xs text-red-600">
              Action immédiate requise · allez à la section incidents pour résoudre.
            </p>
          </div>
          <Link
            href="/dashboard/admin/internat/incidents"
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap"
          >
            Voir →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Lits occupés"
          value={`${occupied}/${totalBeds}`}
          sub={loading ? "..." : `${occupancyRate}%`}
          color="amber"
        />
        <KpiCard
          label="Lits libres"
          value={String(free)}
          sub={`${totalBeds > 0 ? Math.round((free / totalBeds) * 100) : 0}% dispo`}
          color="green"
        />
        <KpiCard
          label="Incidents 7j"
          value={String(dashboard?.incidents_7d ?? 0)}
          sub={`${dashboard?.incidents_30d ?? 0} sur 30j`}
          color="red"
        />
        <KpiCard
          label="Visites aujourd&apos;hui"
          value={String(dashboard?.visits_today ?? 0)}
          sub="registre de visites"
          color="blue"
        />
      </div>

      {/* Bandeau occupation + tendance */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Taux d&apos;occupation</h3>
          <span className="text-sm font-bold text-slate-800">{occupancyRate}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              occupancyRate > 90 ? "bg-red-500" : occupancyRate > 70 ? "bg-amber-500" : "bg-green-500"
            }`}
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{occupied} occupés</span>
          <span>{free} disponibles</span>
        </div>
        {sparkData.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Tendance 30 derniers jours</p>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-12">
              <path d={sparkPath} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}
      </div>

      {/* Élèves à risque */}
      {studentsAtRisk.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Élèves à risque ({criticalStudents.length + highStudents.length} élevé/critique)
            </h3>
            <Link
              href="/dashboard/admin/internat/incidents"
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Voir tout →
            </Link>
          </div>
          <div className="space-y-2">
            {studentsAtRisk.map((s) => (
              <div
                key={s.student_id}
                className={`p-3 rounded-xl border ${
                  s.risk_level === "critical"
                    ? "border-red-200 bg-red-50/50"
                    : s.risk_level === "high"
                    ? "border-orange-200 bg-orange-50/50"
                    : s.risk_level === "medium"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-slate-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {s.section_name ?? "—"} · Chambre {s.room_number ?? "—"}
                    </p>
                  </div>
                  <RiskBadge level={s.risk_level} />
                  <div className="ml-3 text-right">
                    <p className="text-xs text-slate-500">
                      {s.incidents_mineur + s.incidents_majeur + s.incidents_grave} incidents
                    </p>
                    {s.incidents_grave > 0 && (
                      <p className="text-xs text-red-600 font-semibold">{s.incidents_grave} grave(s)</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ActionCard href="/dashboard/admin/internat/batiments" icon="🏗️" title="Bâtiments" sub="Gérer les chambres" />
        <ActionCard href="/dashboard/admin/internat/incidents" icon="⚠️" title="Incidents" sub="Signaler / résoudre" />
        <ActionCard href="/dashboard/admin/internat/affectations" icon="🛏️" title="Affectations" sub="Lits et rotations" />
        <ActionCard href="/dashboard/admin/internat/visites" icon="👋" title="Visites" sub="Registre" />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: "blue" | "amber" | "green" | "red";
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <span className="text-lg font-bold">{value.charAt(0)}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function RiskBadge({ level }: { level: InternatStudentAtRisk["risk_level"] }) {
  const map: Record<InternatStudentAtRisk["risk_level"], { label: string; cls: string }> = {
    critical: { label: "Critique", cls: "bg-red-100 text-red-700" },
    high: { label: "Élevé", cls: "bg-orange-100 text-orange-700" },
    medium: { label: "Moyen", cls: "bg-amber-100 text-amber-700" },
    low: { label: "Faible", cls: "bg-slate-100 text-slate-600" },
  };
  const m = map[level];
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ActionCard({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-center"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </Link>
  );
}
