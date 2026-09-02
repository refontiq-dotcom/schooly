"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatVisit, Student } from "@/types";

interface VisitWithStudent extends InternatVisit {
  student?: Student;
}

export default function VisitesPage() {
  const [visits, setVisits] = useState<VisitWithStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [todayFilter, setTodayFilter] = useState(true);
  const [formData, setFormData] = useState({
    student_id: "",
    visitor_name: "",
    visitor_phone: "",
    relationship: "",
    visit_date: new Date().toISOString().split("T")[0],
    arrive_at: "",
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

    // Load visits
    const { data: visitsData } = await supabase
      .from("internat_visits")
      .select("*")
      .order("created_at", { ascending: false });

    if (visitsData) {
      const enriched = await Promise.all(
        visitsData.map(async (visit) => {
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .eq("id", visit.student_id)
            .single();

          return { ...visit, student };
        })
      );

      setVisits(enriched);
    }

    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const { error } = await supabase.from("internat_visits").insert({
      student_id: formData.student_id,
      visitor_name: formData.visitor_name,
      visitor_phone: formData.visitor_phone || null,
      relationship: formData.relationship || null,
      visit_date: formData.visit_date,
      arrive_at: formData.arrive_at || timeStr,
      approved_by: user.id,
    });

    if (!error) {
      setShowForm(false);
      setFormData({
        student_id: "",
        visitor_name: "",
        visitor_phone: "",
        relationship: "",
        visit_date: new Date().toISOString().split("T")[0],
        arrive_at: "",
      });
      loadData();
    }
    setSaving(false);
  }

  async function handleCheckOut(id: string) {
    const supabase = createClient();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    await supabase
      .from("internat_visits")
      .update({ leave_at: timeStr })
      .eq("id", id);

    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette visite ?")) return;
    
    const supabase = createClient();
    await supabase.from("internat_visits").delete().eq("id", id);
    loadData();
  }

  const today = new Date().toISOString().split("T")[0];
  const todayVisits = visits.filter((v) => v.visit_date === today);
  const pastVisits = visits.filter((v) => v.visit_date !== today);
  const activeVisits = todayVisits.filter((v) => !v.leave_at);

  const filteredVisits = todayFilter ? todayVisits : pastVisits;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <span className="text-slate-800">Visites</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">📍 Visites</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registre des visites de l&apos;internat
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Enregistrer une visite
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-green-600">{activeVisits.length}</p>
          <p className="text-xs text-slate-500">En cours</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">{todayVisits.length}</p>
          <p className="text-xs text-slate-500">Aujourd&apos;hui</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-blue-600">{visits.length}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </div>

      {/* Active Visits Alert */}
      {activeVisits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            👥 {activeVisits.length} visite(s) en cours
          </p>
          <div className="flex flex-wrap gap-2">
            {activeVisits.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-sm border border-amber-200"
              >
                <span className="font-medium text-slate-700">{v.visitor_name}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-600">{v.student?.full_name}</span>
                <button
                  onClick={() => handleCheckOut(v.id)}
                  className="ml-2 text-xs font-medium text-red-600 hover:text-red-700"
                >
                  ✕ Sortie
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Enregistrer une visite</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Élève visité</label>
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du visiteur</label>
                <input
                  type="text"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                  placeholder="Ex: M. Dupont"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.visitor_phone}
                    onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                    placeholder="+225 XX XX XX XX"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lien familial</label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    placeholder="Ex: Parent, Tuteur..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.visit_date}
                    onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Heure d&apos;arrivée</label>
                  <input
                    type="time"
                    value={formData.arrive_at}
                    onChange={(e) => setFormData({ ...formData, arrive_at: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
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
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTodayFilter(true)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            todayFilter
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Aujourd&apos;hui ({todayVisits.length})
        </button>
        <button
          onClick={() => setTodayFilter(false)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            !todayFilter
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Historique ({pastVisits.length})
        </button>
      </div>

      {/* Visits List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📍</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {todayFilter ? "Aucune visite aujourd&apos;hui" : "Aucune visite dans l&apos;historique"}
          </h3>
          <p className="text-sm text-slate-500">Les visites apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Visiteur</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Élève</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Lien</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Arrivée</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Départ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                          {visit.visitor_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{visit.visitor_name}</p>
                          {visit.visitor_phone && (
                            <p className="text-xs text-slate-500">{visit.visitor_phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {visit.student?.full_name || "Inconnu"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {visit.relationship || "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {visit.arrive_at || "-"}
                    </td>
                    <td className="px-5 py-4">
                      {visit.leave_at ? (
                        <span className="text-sm text-slate-600">{visit.leave_at}</span>
                      ) : (
                        <button
                          onClick={() => handleCheckOut(visit.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Enregistrer sortie
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(visit.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
