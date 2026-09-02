"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  InternatBlock,
  InternatBlockCapacity,
  InternatRoom,
  InternatBed,
  InternatAssignment,
  InternatIncident,
  InternatRollCall,
  INTERNAT_GENDER_LABELS,
  INTERNAT_GENDER_ICONS,
} from "@/types";

export default function InternatOverviewPage() {
  const [blocks, setBlocks] = useState<InternatBlock[]>([]);
  const [capacity, setCapacity] = useState<InternatBlockCapacity[]>([]);
  const [stats, setStats] = useState({
    totalBeds: 0,
    occupiedBeds: 0,
    freeBeds: 0,
    totalBlocks: 0,
    todayIncidents: 0,
    todayRollCalls: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<InternatIncident[]>([]);
  const [todayRollCalls, setTodayRollCalls] = useState<InternatRollCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    
    // Get establishment_id from profile
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
      .eq("establishment_id", estId)
      .order("name");

    if (blocksData) {
      setBlocks(blocksData);

      // Load rooms and beds for capacity
      const blockIds = blocksData.map((b) => b.id);
      
      const { data: roomsData } = await supabase
        .from("internat_rooms")
        .select("id, block_id, bed_count, status")
        .in("block_id", blockIds);

      if (roomsData) {
        const roomIds = roomsData.map((r) => r.id);
        
        const { data: bedsData } = await supabase
          .from("internat_beds")
          .select("id, room_id, status")
          .in("room_id", roomIds);

        if (bedsData) {
          // Calculate capacity per block
          const capacityMap: Record<string, InternatBlockCapacity> = {};
          
          blocksData.forEach((block) => {
            capacityMap[block.id] = {
              block_id: block.id,
              establishment_id: estId,
              block_name: block.name,
              gender: block.gender,
              total_beds: 0,
              occupied_beds: 0,
              free_beds: 0,
              capacity: block.capacity,
            };
          });

          roomsData.forEach((room) => {
            const blockCap = capacityMap[room.block_id];
            if (blockCap) {
              blockCap.total_beds += room.bed_count;
            }
          });

          bedsData.forEach((bed) => {
            const room = roomsData.find((r) => r.id === bed.room_id);
            if (room) {
              const blockCap = capacityMap[room.block_id];
              if (blockCap) {
                if (bed.status === "occupe") {
                  blockCap.occupied_beds++;
                } else if (bed.status === "libre") {
                  blockCap.free_beds++;
                }
              }
            }
          });

          const capArray = Object.values(capacityMap);
          setCapacity(capArray);

          setStats({
            totalBeds: capArray.reduce((sum, c) => sum + c.total_beds, 0),
            occupiedBeds: capArray.reduce((sum, c) => sum + c.occupied_beds, 0),
            freeBeds: capArray.reduce((sum, c) => sum + c.free_beds, 0),
            totalBlocks: blocksData.length,
            todayIncidents: 0,
            todayRollCalls: 0,
          });
        }
      }
    }

    // Load today's incidents
    const today = new Date().toISOString().split("T")[0];
    
    const { data: incidentsData } = await supabase
      .from("internat_incidents")
      .select("*")
      .eq("establishment_id", estId)
      .eq("incident_date", today)
      .order("created_at", { ascending: false });

    if (incidentsData) {
      setRecentIncidents(incidentsData);
      setStats((prev) => ({ ...prev, todayIncidents: incidentsData.length }));
    }

    // Load today's roll calls
    const { data: rollCallsData } = await supabase
      .from("internat_roll_calls")
      .select("*")
      .in("block_id", blocksData?.map((b) => b.id) || [])
      .eq("roll_call_date", today);

    if (rollCallsData) {
      setTodayRollCalls(rollCallsData);
      setStats((prev) => ({ ...prev, todayRollCalls: rollCallsData.length }));
    }

    setLoading(false);
  }

  const occupancyRate = stats.totalBeds > 0 
    ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏠 Internat</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestion de l&apos;internat et du logement des élèves
          </p>
        </div>
        <Link
          href="/dashboard/admin/internat/batiments"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter un bâtiment
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total beds */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.totalBeds}</p>
          <p className="text-xs text-slate-500 mt-1">Lits totaux</p>
        </div>

        {/* Occupied */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              {occupancyRate}%
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.occupiedBeds}</p>
          <p className="text-xs text-slate-500 mt-1">Lits occupés</p>
        </div>

        {/* Free */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.freeBeds}</p>
          <p className="text-xs text-slate-500 mt-1">Lits disponibles</p>
        </div>

        {/* Incidents today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.todayIncidents}</p>
          <p className="text-xs text-slate-500 mt-1">Incidents aujourd&apos;hui</p>
        </div>
      </div>

      {/* Occupancy Progress Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Taux d&apos;occupation global</h3>
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
          <span>{stats.occupiedBeds} occupés</span>
          <span>{stats.freeBeds} disponibles</span>
        </div>
      </div>

      {/* Buildings Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buildings */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Bâtiments</h3>
            <Link
              href="/dashboard/admin/internat/batiments"
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Voir tout →
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : capacity.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Aucun bâtiment configuré</p>
              <Link
                href="/dashboard/admin/internat/batiments/new"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                + Ajouter un bâtiment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {capacity.map((cap) => {
                const blockCapacity = cap.total_beds > 0 
                  ? Math.round((cap.occupied_beds / cap.total_beds) * 100) 
                  : 0;
                
                return (
                  <Link
                    key={cap.block_id}
                    href={`/dashboard/admin/internat/batiments/${cap.block_id}`}
                    className="block p-4 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {cap.gender === "garcon" ? "👦" : cap.gender === "fille" ? "👧" : "🏠"}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{cap.block_name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {cap.occupied_beds}/{cap.total_beds} lits
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          blockCapacity > 90 ? "bg-red-500" : blockCapacity > 70 ? "bg-amber-500" : "bg-green-500"
                        }`}
                        style={{ width: `${blockCapacity}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Incidents récents</h3>
            <Link
              href="/dashboard/admin/internat/incidents"
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Voir tout →
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentIncidents.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Aucun incident aujourd&apos;hui</p>
              <p className="text-xs text-slate-400 mt-1">Tout va bien ! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {incident.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {incident.category === "discipline" ? "📏 Discipline" :
                         incident.category === "sante" ? "🏥 Santé" :
                         incident.category === "comportement" ? "⚠️ Comportement" :
                         "📌 Autre"}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-lg ${
                        incident.severity === "grave"
                          ? "bg-red-100 text-red-700"
                          : incident.severity === "majeur"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/dashboard/admin/internat/roll-calls"
          className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Appels</p>
          <p className="text-xs text-slate-500 mt-1">Matin & Soir</p>
        </Link>

        <Link
          href="/dashboard/admin/internat/affectations"
          className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Affectations</p>
          <p className="text-xs text-slate-500 mt-1">Gérer les lits</p>
        </Link>

        <Link
          href="/dashboard/admin/internat/incidents"
          className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Incidents</p>
          <p className="text-xs text-slate-500 mt-1">Signaler</p>
        </Link>

        <Link
          href="/dashboard/admin/internat/visites"
          className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">Visites</p>
          <p className="text-xs text-slate-500 mt-1">Registre</p>
        </Link>
      </div>
    </div>
  );
}
