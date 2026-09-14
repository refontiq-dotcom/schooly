"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatBlock, InternatRoom, InternatBed, InternatAssignment, Student } from "@/types";

interface AssignmentWithDetails extends InternatAssignment {
  student?: Student;
  bed?: InternatBed;
  room?: InternatRoom;
  block?: InternatBlock;
}

export default function AffectationsPage() {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [blocks, setBlocks] = useState<InternatBlock[]>([]);
  const [rooms, setRooms] = useState<InternatRoom[]>([]);
  const [beds, setBeds] = useState<InternatBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "actif" | "suspendu" | "termine">("all");
  const [formData, setFormData] = useState({
    student_id: "",
    block_id: "",
    room_id: "",
    bed_id: "",
    academic_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
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

    // Load blocks
    const { data: blocksData } = await supabase
      .from("internat_blocks")
      .select("*")
      .eq("establishment_id", estId);

    if (blocksData) {
      setBlocks(blocksData);

      // Load rooms
      const { data: roomsData } = await supabase
        .from("internat_rooms")
        .select("*")
        .in("block_id", blocksData.map((b) => b.id));

      if (roomsData) {
        setRooms(roomsData);

        // Load beds
        const { data: bedsData } = await supabase
          .from("internat_beds")
          .select("*")
          .in("room_id", roomsData.map((r) => r.id))
          .eq("status", "libre");

        if (bedsData) setBeds(bedsData);
      }
    }

    // Load assignments
    const { data: assignmentsData } = await supabase
      .from("internat_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (assignmentsData) {
      // Enrich with details
      const enriched = await Promise.all(
        assignmentsData.map(async (assignment) => {
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .eq("id", assignment.student_id)
            .single();

          const { data: bed } = await supabase
            .from("internat_beds")
            .select("*")
            .eq("id", assignment.bed_id)
            .single();

          let room = null;
          let block = null;

          if (bed) {
            const { data: roomData } = await supabase
              .from("internat_rooms")
              .select("*")
              .eq("id", bed.room_id)
              .single();

            room = roomData;

            if (room) {
              const { data: blockData } = await supabase
                .from("internat_blocks")
                .select("*")
                .eq("id", room.block_id)
                .single();

              block = blockData;
            }
          }

          return { ...assignment, student, bed, room, block };
        })
      );

      setAssignments(enriched);
    }

    setLoading(false);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("internat_assignments").insert({
      student_id: formData.student_id,
      bed_id: formData.bed_id,
      academic_year: formData.academic_year,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: "actif",
      assigned_by: user.id,
    });

    if (!error) {
      // Update bed status
      await supabase
        .from("internat_beds")
        .update({ status: "occupe" })
        .eq("id", formData.bed_id);

      setShowForm(false);
      setFormData({
        student_id: "",
        block_id: "",
        room_id: "",
        bed_id: "",
        academic_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
      });
      loadData();
    }
    setSaving(false);
  }

  async function handleUnassign(assignment: AssignmentWithDetails) {
    if (!confirm(`Désaffecter ${assignment.student?.full_name || "cet élève"} ?`)) return;

    const supabase = createClient();

    // Update assignment status
    await supabase
      .from("internat_assignments")
      .update({ status: "termine", end_date: new Date().toISOString().split("T")[0] })
      .eq("id", assignment.id);

    // Free the bed
    if (assignment.bed_id) {
      await supabase
        .from("internat_beds")
        .update({ status: "libre" })
        .eq("id", assignment.bed_id);
    }

    loadData();
  }

  const filteredAssignments = assignments.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const availableBeds = beds.filter((b) => b.status === "libre");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <span className="text-slate-800">Affectations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">🛏️ Affectations</h1>
          <p className="text-sm text-slate-500 mt-1">
            {assignments.filter((a) => a.status === "actif").length} élève(s) actuellement logé(s)
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={availableBeds.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle affectation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-green-600">{assignments.filter((a) => a.status === "actif").length}</p>
          <p className="text-xs text-slate-500">Actifs</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-amber-600">{assignments.filter((a) => a.status === "suspendu").length}</p>
          <p className="text-xs text-slate-500">Suspendus</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-600">{assignments.filter((a) => a.status === "termine").length}</p>
          <p className="text-xs text-slate-500">Terminés</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-blue-600">{availableBeds.length}</p>
          <p className="text-xs text-slate-500">Lits disponibles</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", "actif", "suspendu", "termine"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f === "all" ? "Tous" : f === "actif" ? "Actifs" : f === "suspendu" ? "Suspendus" : "Terminés"}
          </button>
        ))}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nouvelle affectation</h2>
            <form onSubmit={handleAssign} className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bâtiment</label>
                <select
                  value={formData.block_id}
                  onChange={(e) => {
                    setFormData({ ...formData, block_id: e.target.value, room_id: "", bed_id: "" });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">Sélectionner un bâtiment</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chambre</label>
                <select
                  value={formData.room_id}
                  onChange={(e) => {
                    setFormData({ ...formData, room_id: e.target.value, bed_id: "" });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                  disabled={!formData.block_id}
                >
                  <option value="">Sélectionner une chambre</option>
                  {rooms
                    .filter((r) => r.block_id === formData.block_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>Ch. {r.number}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lit</label>
                <select
                  value={formData.bed_id}
                  onChange={(e) => setFormData({ ...formData, bed_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                  disabled={!formData.room_id}
                >
                  <option value="">Sélectionner un lit</option>
                  {beds
                    .filter((b) => b.room_id === formData.room_id && b.status === "libre")
                    .map((b) => (
                      <option key={b.id} value={b.id}>Lit {b.bed_number}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Année scolaire</label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  {saving ? "Affectation..." : "Affecter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucune affectation</h3>
          <p className="text-sm text-slate-500">Aucune affectation {filter !== "all" ? `avec le statut "${filter}"` : ""}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Élève</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bâtiment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Chambre</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lit</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Période</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                          {assignment.student?.full_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {assignment.student?.full_name || "Inconnu"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {assignment.block?.name || "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      Ch. {assignment.room?.number || "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      Lit {assignment.bed?.bed_number || "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {assignment.start_date} → {assignment.end_date || "∞"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-lg ${
                          assignment.status === "actif"
                            ? "bg-green-100 text-green-700"
                            : assignment.status === "suspendu"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {assignment.status === "actif" && (
                        <button
                          onClick={() => handleUnassign(assignment)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Désaffecter
                        </button>
                      )}
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
