"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SchoolGroup, SchoolGroupStats, GroupBranch } from "@/types";

export default function ReseauPage() {
  const [group, setGroup] = useState<SchoolGroup | null>(null);
  const [stats, setStats] = useState<SchoolGroupStats | null>(null);
  const [branches, setBranches] = useState<GroupBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroupData();
  }, []);

  async function loadGroupData() {
    setLoading(true);
    try {
      // Check if the current user has a group via their establishment
      const res = await fetch("/api/school-groups");
      if (res.ok) {
        const data = await res.json();
        if (data.group) {
          setGroup(data.group);
          setStats(data.stats);
          setBranches(data.branches ?? []);
        }
      }
    } catch {
      // Group doesn't exist yet — show creation form
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formName.trim()) {
      setError("Le nom du réseau est requis");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/school-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || null,
          headquarters_city: formCity.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors de la création");
        return;
      }

      await loadGroupData();
    } catch {
      setError("Erreur réseau");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-48 mb-3" />
            <div className="h-3 bg-slate-50 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  // ── No group yet — show creation form ──
  if (!group) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mon réseau scolaire 🏫</h1>
          <p className="text-sm text-slate-400 mt-1">
            Créez un réseau pour gérer plusieurs succursales sous une même marque.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Créer un réseau</h2>
          <p className="text-sm text-slate-400 mb-5">
            Un réseau regroupe plusieurs établissements (succursales) sous une même identité.
          </p>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nom du réseau *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="ex: Réseau Scolaire Progrès"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ville siège
                </label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="ex: Abidjan"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Description du réseau"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {creating ? "Création…" : "Créer le réseau"}
            </button>
          </form>
        </div>

        {/* Info card */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">💡 Pourquoi un réseau ?</h3>
          <ul className="text-sm text-amber-700 space-y-1.5">
            <li>• Gérer plusieurs succursales sous une même marque</li>
            <li>• Vue consolidée des élèves et finances</li>
            <li>• Partager les professeurs entre les branches</li>
            <li>• Basculer facilement entre les succursales</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Group exists — show overview ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{group.name} 🏫</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {group.headquarters_city ? `Siège : ${group.headquarters_city}` : "Réseau scolaire"}
            {branches.length > 0 && ` · ${branches.length} succursale${branches.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            emoji="🏫"
            label="Succursales"
            value={String(stats.branch_count)}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            emoji="👥"
            label="Élèves"
            value={String(stats.total_students)}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            emoji="👨‍🏫"
            label="Professeurs"
            value={String(stats.teacher_count)}
            color="bg-purple-50 text-purple-700"
          />
          <StatCard
            emoji="📋"
            label="Secrétariat"
            value={String(stats.secretariat_count)}
            color="bg-amber-50 text-amber-700"
          />
        </div>
      )}

      {/* Branches */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 text-[15px]">Succursales</h2>
        </div>

        {branches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  {branch.logo_url ? (
                    <img
                      src={branch.logo_url}
                      alt={branch.name}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-sm font-bold text-slate-600">
                      {branch.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{branch.name}</p>
                    <p className="text-xs text-slate-400">
                      📍 {branch.city}
                      {branch.branch_name && ` · ${branch.branch_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    👥 {branch.student_count} élève{branch.student_count !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href="/dashboard/admin"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700"
                  >
                    Gérer →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">
            Aucune succursale associée. Ajoutez un établissement depuis la page classes.
          </p>
        )}
      </div>

      {/* How to add branches */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">📌 Ajouter une succursale</h3>
        <ol className="text-sm text-slate-500 space-y-1.5 list-decimal list-inside">
          <li>Créez le compte admin de la nouvelle succursale</li>
          <li>Demandez au super admin du réseau d&apos;ajouter la succursale</li>
          <li>Ou contactez le support Schooly pour lien rapide</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  color,
}: {
  emoji: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  );
}
