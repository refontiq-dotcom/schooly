"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InternatBlock, InternatRoom, InternatBed } from "@/types";
import { INTERNAT_GENDER_LABELS, INTERNAT_GENDER_ICONS } from "@/types";

export default function BlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = use(params);
  const [block, setBlock] = useState<InternatBlock | null>(null);
  const [rooms, setRooms] = useState<(InternatRoom & { beds: InternatBed[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    number: "",
    bed_count: 4,
    status: "disponible" as "disponible" | "maintenance" | "complet",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [blockId]);

  async function loadData() {
    const supabase = createClient();

    // Load block
    const { data: blockData } = await supabase
      .from("internat_blocks")
      .select("*")
      .eq("id", blockId)
      .single();

    if (blockData) setBlock(blockData);

    // Load rooms
    const { data: roomsData } = await supabase
      .from("internat_rooms")
      .select("*")
      .eq("block_id", blockId)
      .order("number");

    if (roomsData) {
      // Load beds for each room
      const roomsWithBeds = await Promise.all(
        roomsData.map(async (room) => {
          const { data: bedsData } = await supabase
            .from("internat_beds")
            .select("*")
            .eq("room_id", room.id)
            .order("bed_number");

          return { ...room, beds: bedsData || [] };
        })
      );
      setRooms(roomsWithBeds);
    }

    setLoading(false);
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();

    // Create room
    const { data: roomData, error: roomError } = await supabase
      .from("internat_rooms")
      .insert({
        block_id: blockId,
        number: formData.number,
        bed_count: formData.bed_count,
        status: formData.status,
      })
      .select()
      .single();

    if (!roomError && roomData) {
      // Create beds
      const beds = Array.from({ length: formData.bed_count }, (_, i) => ({
        room_id: roomData.id,
        bed_number: i + 1,
        status: "libre" as const,
      }));

      await supabase.from("internat_beds").insert(beds);

      setShowForm(false);
      setFormData({ number: "", bed_count: 4, status: "disponible" });
      loadData();
    }
    setSaving(false);
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm("Supprimer cette chambre et ses lits ?")) return;
    
    const supabase = createClient();
    await supabase.from("internat_beds").delete().eq("room_id", roomId);
    await supabase.from("internat_rooms").delete().eq("id", roomId);
    loadData();
  }

  const totalBeds = rooms.reduce((sum, r) => sum + r.beds.length, 0);
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.beds.filter((b) => b.status === "occupe").length, 0);
  const freeBeds = rooms.reduce((sum, r) => sum + r.beds.filter((b) => b.status === "libre").length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/admin/internat" className="hover:text-amber-600">Internat</Link>
            <span>/</span>
            <Link href="/dashboard/admin/internat/batiments" className="hover:text-amber-600">Bâtiments</Link>
            <span>/</span>
            <span className="text-slate-800">{block?.name || "..."}</span>
          </div>
          <div className="flex items-center gap-3">
            {block && <span className="text-3xl">{INTERNAT_GENDER_ICONS[block.gender]}</span>}
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{block?.name || "Chargement..."}</h1>
              <p className="text-sm text-slate-500">{INTERNAT_GENDER_LABELS[block?.gender || "mixte"]}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle chambre
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-800">{rooms.length}</p>
          <p className="text-xs text-slate-500">Chambres</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-green-600">{freeBeds}</p>
          <p className="text-xs text-slate-500">Lits libres</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-2xl font-bold text-amber-600">{occupiedBeds}</p>
          <p className="text-xs text-slate-500">Lits occupés</p>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Nouvelle chambre</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Numéro de chambre</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="Ex: 101, A1, B2..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de lits</label>
                <input
                  type="number"
                  value={formData.bed_count}
                  onChange={(e) => setFormData({ ...formData, bed_count: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={20}
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

      {/* Rooms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucune chambre</h3>
          <p className="text-sm text-slate-500 mb-4">Ajoutez des chambres à ce bâtiment</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter une chambre
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const occupied = room.beds.filter((b) => b.status === "occupe").length;
            const free = room.beds.filter((b) => b.status === "libre").length;
            const maintenance = room.beds.filter((b) => b.status === "maintenance").length;

            return (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">Ch. {room.number}</h3>
                    <p className="text-xs text-slate-500">{room.beds.length} lits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        room.status === "disponible"
                          ? "bg-green-100 text-green-700"
                          : room.status === "maintenance"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {room.status}
                    </span>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Beds visualization */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {room.beds.map((bed) => (
                    <div
                      key={bed.id}
                      className={`p-2 rounded-lg text-center text-xs font-medium ${
                        bed.status === "occupe"
                          ? "bg-amber-100 text-amber-700"
                          : bed.status === "libre"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      Lit {bed.bed_number}
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {free} libre{free !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {occupied} occupé{occupied !== 1 ? "s" : ""}
                    </span>
                    {maintenance > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        {maintenance} maintenance
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
