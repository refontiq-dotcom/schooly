"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatBlock, InternatRollCall, InternatRollItem, InternatAssignment, Student } from "@/types";
import { INTERNAT_ROLL_CALL_LABELS } from "@/types";

interface RollCallWithDetails extends InternatRollCall {
  block?: InternatBlock;
  items?: (InternatRollItem & { student?: Student })[];
}

export default function RollCallsPage() {
  const [blocks, setBlocks] = useState<InternatBlock[]>([]);
  const [rollCalls, setRollCalls] = useState<RollCallWithDetails[]>([]);
  const [assignments, setAssignments] = useState<(InternatAssignment & { student?: Student })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedRollCall, setSelectedRollCall] = useState<RollCallWithDetails | null>(null);
  const [formData, setFormData] = useState({
    block_id: "",
    roll_call_date: new Date().toISOString().split("T")[0],
    roll_call_type: "matin" as "matin" | "soir",
  });
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

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

    // Load blocks
    const { data: blocksData } = await supabase
      .from("internat_blocks")
      .select("*")
      .eq("establishment_id", estId);

    if (blocksData) setBlocks(blocksData);

    // Load recent roll calls
    const { data: rollCallsData } = await supabase
      .from("internat_roll_calls")
      .select("*")
      .in("block_id", blocksData?.map((b) => b.id) || [])
      .order("roll_call_date", { ascending: false })
      .order("roll_call_type")
      .limit(20);

    if (rollCallsData) {
      const enriched = await Promise.all(
        rollCallsData.map(async (rc) => {
          const block = blocksData?.find((b) => b.id === rc.block_id);
          
          const { data: itemsData } = await supabase
            .from("internat_roll_items")
            .select("*")
            .eq("roll_call_id", rc.id);

          let itemsWithStudents: (InternatRollItem & { student?: Student })[] = [];
          
          if (itemsData) {
            itemsWithStudents = await Promise.all(
              itemsData.map(async (item) => {
                const { data: student } = await supabase
                  .from("students")
                  .select("*")
                  .eq("id", item.student_id)
                  .single();

                return { ...item, student };
              })
            );
          }

          return { ...rc, block, items: itemsWithStudents };
        })
      );

      setRollCalls(enriched);
    }

    // Load active assignments with students
    const { data: assignmentsData } = await supabase
      .from("internat_assignments")
      .select("*")
      .eq("status", "actif");

    if (assignmentsData) {
      const enriched = await Promise.all(
        assignmentsData.map(async (a) => {
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .eq("id", a.student_id)
            .single();

          return { ...a, student };
        })
      );

      setAssignments(enriched);
    }

    setLoading(false);
  }

  async function handleCreateRollCall(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create roll call
    const { data: rollCallData, error: rcError } = await supabase
      .from("internat_roll_calls")
      .insert({
        block_id: formData.block_id,
        roll_call_date: formData.roll_call_date,
        roll_call_type: formData.roll_call_type,
        recorded_by: user.id,
      })
      .select()
      .single();

    if (!rcError && rollCallData) {
      // Get students assigned to this block
      const blockAssignments = assignments.filter((a) => {
        // Need to check if the bed is in a room of this block
        // For now, we'll add all assignments
        return true;
      });

      // Create roll items (default: all present)
      if (blockAssignments.length > 0) {
        const items = blockAssignments.map((a) => ({
          roll_call_id: rollCallData.id,
          student_id: a.student_id,
          present: true,
          note: null,
          late_minutes: 0,
        }));

        await supabase.from("internat_roll_items").insert(items);
      }

      setShowForm(false);
      setFormData({
        block_id: "",
        roll_call_date: new Date().toISOString().split("T")[0],
        roll_call_type: "matin",
      });
      
      // Reload and open the new roll call
      await loadData();
      const newRollCall = rollCalls.find((rc) => rc.id === rollCallData.id);
      if (newRollCall) setSelectedRollCall(newRollCall);
    }
    setSaving(false);
  }

  async function handleTogglePresent(itemId: string, currentPresent: boolean) {
    const supabase = createClient();
    await supabase
      .from("internat_roll_items")
      .update({ present: !currentPresent })
      .eq("id", itemId);

    // Reload
    loadData();
  }

  async function handleDeleteRollCall(id: string) {
    if (!confirm("Supprimer cet appel ?")) return;
    
    const supabase = createClient();
    await supabase.from("internat_roll_items").delete().eq("roll_call_id", id);
    await supabase.from("internat_roll_calls").delete().eq("id", id);
    loadData();
  }

  const todayRollCalls = rollCalls.filter((rc) => rc.roll_call_date === today);
  const pastRollCalls = rollCalls.filter((rc) => rc.roll_call_date !== today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <span className="text-slate-800">Appels</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">📋 Appels</h1>
          <p className="text-sm text-slate-500 mt-1">
            Présences matin et soir de l&apos;internat
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvel appel
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nouvel appel</h2>
            <form onSubmit={handleCreateRollCall} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bâtiment</label>
                <select
                  value={formData.block_id}
                  onChange={(e) => setFormData({ ...formData, block_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">Sélectionner un bâtiment</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.roll_call_date}
                    onChange={(e) => setFormData({ ...formData, roll_call_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["matin", "soir"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, roll_call_type: type })}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          formData.roll_call_type === type
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{type === "matin" ? "🌅" : "🌙"}</span>
                        <span className="text-xs font-medium">{INTERNAT_ROLL_CALL_LABELS[type]}</span>
                      </button>
                    ))}
                  </div>
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
                  {saving ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roll Call Detail Modal */}
      {selectedRollCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {INTERNAT_ROLL_CALL_LABELS[selectedRollCall.roll_call_type]}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedRollCall.block?.name} • {selectedRollCall.roll_call_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedRollCall(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">
                  {selectedRollCall.items?.filter((i) => i.present).length || 0}
                </p>
                <p className="text-xs text-green-600">Présents</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-2xl font-bold text-red-600">
                  {selectedRollCall.items?.filter((i) => !i.present).length || 0}
                </p>
                <p className="text-xs text-red-600">Absents</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <p className="text-2xl font-bold text-amber-600">
                  {selectedRollCall.items?.filter((i) => i.late_minutes > 0).length || 0}
                </p>
                <p className="text-xs text-amber-600">Retards</p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {selectedRollCall.items?.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    item.present ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      item.present ? "bg-green-200 text-green-700" : "bg-red-200 text-red-700"
                    }`}>
                      {item.student?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {item.student?.full_name || "Inconnu"}
                      </p>
                      {item.late_minutes > 0 && (
                        <p className="text-xs text-amber-600">+{item.late_minutes} min de retard</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePresent(item.id, item.present)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      item.present
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  >
                    {item.present ? "Présent ✓" : "Absent ✗"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today's Roll Calls */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">📅 Aujourd&apos;hui</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : todayRollCalls.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-sm text-slate-500">Aucun appel aujourd&apos;hui</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              + Créer un appel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {todayRollCalls.map((rc) => {
              const present = rc.items?.filter((i) => i.present).length || 0;
              const total = rc.items?.length || 0;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;

              return (
                <div
                  key={rc.id}
                  className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedRollCall(rc)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{rc.roll_call_type === "matin" ? "🌅" : "🌙"}</span>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {INTERNAT_ROLL_CALL_LABELS[rc.roll_call_type]}
                        </p>
                        <p className="text-xs text-slate-500">{rc.block?.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRollCall(rc.id);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{present}/{total} présents</span>
                    <span className={`font-bold ${rate >= 90 ? "text-green-600" : rate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {rate}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        rate >= 90 ? "bg-green-500" : rate >= 70 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Roll Calls */}
      {pastRollCalls.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">📆 Appels précédents</h2>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Bâtiment</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Présents</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Taux</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pastRollCalls.slice(0, 10).map((rc) => {
                    const present = rc.items?.filter((i) => i.present).length || 0;
                    const total = rc.items?.length || 0;
                    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

                    return (
                      <tr
                        key={rc.id}
                        className="hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => setSelectedRollCall(rc)}
                      >
                        <td className="px-5 py-3 text-sm text-slate-700">{rc.roll_call_date}</td>
                        <td className="px-5 py-3">
                          <span className="text-sm">
                            {rc.roll_call_type === "matin" ? "🌅 Matin" : "🌙 Soir"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{rc.block?.name}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{present}/{total}</td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-medium ${
                            rate >= 90 ? "text-green-600" : rate >= 70 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRollCall(rc.id);
                            }}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
