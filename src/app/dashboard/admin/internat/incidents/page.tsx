"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatIncident, Student } from "@/types";
import {
  INTERNAT_SEVERITY_LABELS,
  INTERNAT_SEVERITY_COLORS,
  INTERNAT_CATEGORY_LABELS,
} from "@/types";

interface IncidentWithStudent extends InternatIncident {
  student?: Student;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentWithStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "mineur" | "majeur" | "grave">("all");
  const [formData, setFormData] = useState({
    student_id: "",
    incident_date: new Date().toISOString().split("T")[0],
    severity: "mineur" as "mineur" | "majeur" | "grave",
    category: "discipline" as "discipline" | "sante" | "comportement" | "autre",
    title: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

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

    if (!profile?.establishment_id) return;

    const estId = profile.establishment_id;

    // Load students
    const { data: studentsData } = await supabase
      .from("students")
      .select("*")
      .eq("establishment_id", estId);

    if (studentsData) setStudents(studentsData);

    // Load incidents
    const { data: incidentsData } = await supabase
      .from("internat_incidents")
      .select("*")
      .eq("establishment_id", estId)
      .order("incident_date", { ascending: false });

    if (incidentsData) {
      const enriched = await Promise.all(
        incidentsData.map(async (inc) => {
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .eq("id", inc.student_id)
            .single();

          return { ...inc, student };
        })
      );

      setIncidents(enriched);
    }

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

    const { error } = await supabase.from("internat_incidents").insert({
      establishment_id: profile.establishment_id,
      student_id: formData.student_id,
      incident_date: formData.incident_date,
      severity: formData.severity,
      category: formData.category,
      title: formData.title,
      description: formData.description || null,
      reported_by: user.id,
    });

    if (!error) {
      setShowForm(false);
      setFormData({
        student_id: "",
        incident_date: new Date().toISOString().split("T")[0],
        severity: "mineur",
        category: "discipline",
        title: "",
        description: "",
      });
      loadData();
    }
    setSaving(false);
  }

  async function handleResolve(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("internat_incidents")
      .update({
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet incident ?")) return;
    
    const supabase = createClient();
    await supabase.from("internat_incidents").delete().eq("id", id);
    loadData();
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === "all") return true;
    return inc.severity === filter;
  });

  const unresolvedCount = incidents.filter((i) => !i.resolved_at).length;
  const graveCount = incidents.filter((i) => i.severity === "grave" && !i.resolved_at).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <span className="text-slate-800">Incidents</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">⚠️ Incidents</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unresolvedCount} incident(s) non résolu(s)
            {graveCount > 0 && (
              <span className="text-red-600 font-medium"> • {graveCount} grave(s)</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Signaler un incident
        </button>
      </div>

      {/* Alert for grave incidents */}
      {graveCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Incidents graves en attente</p>
            <p className="text-xs text-red-600">{graveCount} incident(s) grave(s) nécessitent une attention immédiate</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", "mineur", "majeur", "grave"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f === "all" ? "Tous" : INTERNAT_SEVERITY_LABELS[f]}
            {f !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({incidents.filter((i) => i.severity === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Signaler un incident</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Élève</label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">Sélectionner un élève</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.incident_date}
                    onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gravité</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="mineur">Mineur</option>
                    <option value="majeur">Majeur</option>
                    <option value="grave">Grave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["discipline", "sante", "comportement", "autre"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        formData.category === cat
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-lg block mb-1">
                        {cat === "discipline" ? "📏" : cat === "sante" ? "🏥" : cat === "comportement" ? "⚠️" : "📌"}
                      </span>
                      <span className="text-xs font-medium">{INTERNAT_CATEGORY_LABELS[cat]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Comportement inapproprié..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Détails de l'incident..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
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
                  {saving ? "Envoi..." : "Signaler"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incidents List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun incident</h3>
          <p className="text-sm text-slate-500">
            {filter !== "all" ? `Aucun incident de gravité "${INTERNAT_SEVERITY_LABELS[filter]}"` : "Tout va bien ! 🎉"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className={`bg-white rounded-2xl border p-5 ${
                incident.resolved_at ? "border-slate-100" : "border-amber-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    INTERNAT_SEVERITY_COLORS[incident.severity]
                  }`}>
                    <span className="text-lg">
                      {incident.severity === "grave" ? "🚨" : incident.severity === "majeur" ? "⚠️" : "⚡"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800">{incident.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                        INTERNAT_SEVERITY_COLORS[incident.severity]
                      }`}>
                        {INTERNAT_SEVERITY_LABELS[incident.severity]}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        {INTERNAT_CATEGORY_LABELS[incident.category]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {incident.student?.full_name || "Élève inconnu"} • {incident.incident_date}
                    </p>
                    {incident.description && (
                      <p className="text-sm text-slate-500 mt-2">{incident.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {incident.resolved_at ? (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                      ✓ Résolu
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolve(incident.id)}
                      className="text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Résoudre
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(incident.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
