"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatBlock } from "@/types";
import { INTERNAT_GENDER_LABELS, INTERNAT_GENDER_ICONS } from "@/types";
import { fetchInternatDashboard } from "@/lib/internat-intelligence/scoring";
import type { InternatDashboardRow } from "@/lib/internat-intelligence/scoring";

export default function BatimentsPage() {
  const [blocks, setBlocks] = useState<InternatBlock[]>([]);
  const [dashboard, setDashboard] = useState<InternatDashboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    gender: "mixte" as "garcon" | "fille" | "mixte",
    capacity: 50,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBlocks();
  }, []);

  async function loadBlocks() {
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

    const [blocksRes, dash] = await Promise.all([
      supabase
        .from("internat_blocks")
        .select("*")
        .eq("establishment_id", estId)
        .order("name"),
      fetchInternatDashboard(supabase, estId),
    ]);

    if (blocksRes.data) setBlocks(blocksRes.data);
    setDashboard(dash);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("establishment_id")
      .eq("id", user.id)
      .single();

    if (!profile?.establishment_id) return;

    const { error } = await supabase.from("internat_blocks").insert({
      establishment_id: profile.establishment_id,
      name: formData.name,
      gender: formData.gender,
      capacity: formData.capacity,
    });

    if (!error) {
      setShowForm(false);
      setFormData({ name: "", gender: "mixte", capacity: 50 });
      loadBlocks();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce bâtiment et toutes ses chambres ?")) return;
    const supabase = createClient();
    await supabase.from("internat_blocks").delete().eq("id", id);
    loadBlocks();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <span className="text-slate-800">Bâtiments</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">🏗️ Bâtiments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez les bâtiments, chambres et lits de l&apos;internat
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau bâtiment
        </button>
      </div>

      {/* Bandeau d'intelligence */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-xs text-slate-500">Capacité totale</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{dashboard.total_beds}</p>
            <p className="text-xs text-slate-400 mt-1">
              {dashboard.occupied_beds} occupés · {dashboard.free_beds} libres · {dashboard.maintenance_beds} maintenance
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-xs text-slate-500">Incidents 30j</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{dashboard.incidents_30d}</p>
            <p className="text-xs text-slate-400 mt-1">
              {dashboard.incidents_7d} sur 7j · {dashboard.grave_open_incidents} grave(s) ouvert(s)
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-xs text-slate-500">Visites du jour</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{dashboard.visits_today}</p>
            <p className="text-xs text-slate-400 mt-1">Registre des visiteurs</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nouveau bâtiment</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du bâtiment</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Bâtiment A, Internat Garçons..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["garcon", "fille", "mixte"] as const).map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setFormData({ ...formData, gender })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        formData.gender === gender
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-2xl block mb-1">{INTERNAT_GENDER_ICONS[gender]}</span>
                      <span className="text-xs font-medium">{INTERNAT_GENDER_LABELS[gender]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacité</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {saving ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏗️</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun bâtiment</h3>
          <p className="text-sm text-slate-500 mb-4">Commencez par ajouter un bâtiment à l&apos;internat</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Ajouter un bâtiment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className={`p-5 ${
                block.gender === "garcon" ? "bg-blue-50" :
                block.gender === "fille" ? "bg-pink-50" :
                "bg-amber-50"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{INTERNAT_GENDER_ICONS[block.gender]}</span>
                    <div>
                      <h3 className="font-bold text-slate-800">{block.name}</h3>
                      <p className="text-xs text-slate-500">{INTERNAT_GENDER_LABELS[block.gender]}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(block.id)}
                    className="p-2 rounded-lg hover:bg-white/80 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Capacité</span>
                  <span className="font-bold text-slate-800">{block.capacity} lits</span>
                </div>

                <Link
                  href={`/dashboard/admin/internat/batiments/${block.id}`}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Gérer les chambres
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
