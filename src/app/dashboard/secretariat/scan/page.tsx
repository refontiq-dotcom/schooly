"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Reservation } from "@/types";

type LookupResult = Reservation & {
  modality?: string;
  modality_name?: string;
  modality_description?: string;
  establishments?: { name: string };
  levels?: { name: string };
  sections?: { name: string };
};

export default function ScanPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalized, setFinalized] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setFinalized(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/lookup?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.reservation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR code invalide");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize() {
    if (!result) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: finalizeError } = await supabase.rpc("finalize_reservation", {
      p_reservation_id: result.id,
    });

    if (finalizeError) {
      setError(finalizeError.message);
      setLoading(false);
      return;
    }

    setFinalized(true);
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-navy">Vérification QR code</h1>

      <form onSubmit={handleLookup} className="card space-y-3">
        <label className="text-sm font-medium text-slate-700">
          Code de réservation (saisi manuellement en v1 — scan caméra prévu en Phase 2)
        </label>
        <input
          className="input"
          placeholder="Coller ou saisir le token du QR code"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          Vérifier
        </button>
      </form>

      {error && <div className="card text-red-600">{error}</div>}

      {result && !finalized && (
        <div className="card space-y-2">
          <div className="badge-success mb-2">QR code valide</div>
          <p><strong>Élève :</strong> {result.student_full_name}</p>
          <p><strong>Parent :</strong> {result.parent_full_name} — {result.parent_phone}</p>
          <p><strong>Établissement :</strong> {result.establishments?.name}</p>
          <p><strong>Niveau / Section :</strong> {result.levels?.name} — {result.sections?.name}</p>
          <p><strong>Statut :</strong> {result.status}</p>
          {result.modality_name && (
            <p><strong>Modalité :</strong> {result.modality_name}</p>
          )}
          {result.modality_description && (
            <p className="text-sm text-slate-500 mt-1">{result.modality_description}</p>
          )}
          <button onClick={handleFinalize} disabled={loading} className="btn-primary w-full mt-3">
            Finaliser l&apos;inscription
          </button>
        </div>
      )}

      {finalized && (
        <div className="card text-emerald-700 bg-emerald-50">
          ✅ Inscription finalisée. L&apos;élève est désormais rattaché à sa section.
        </div>
      )}
    </div>
  );
}
