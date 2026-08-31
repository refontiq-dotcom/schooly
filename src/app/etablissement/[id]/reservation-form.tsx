"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LevelAvailability } from "@/types";

export default function ReservationForm({
  establishmentId,
  levels,
}: {
  establishmentId: string;
  levels: LevelAvailability[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    level_id: levels.find((l) => l.seats_available > 0)?.level_id ?? "",
    student_full_name: "",
    student_birthdate: "",
    parent_full_name: "",
    parent_phone: "",
    parent_email: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishment_id: establishmentId, ...form }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la réservation");

      // Redirection vers le paiement / confirmation
      router.push(`/reservation/confirmation/${data.reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700">Niveau souhaité</label>
        <select
          className="input mt-1"
          required
          value={form.level_id}
          onChange={(e) => setForm({ ...form, level_id: e.target.value })}
        >
          <option value="" disabled>Sélectionner un niveau</option>
          {levels.map((l) => (
            <option key={l.level_id} value={l.level_id} disabled={l.seats_available <= 0}>
              {l.level_name} {l.seats_available <= 0 ? "(complet)" : `(${l.seats_available} places)`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Nom complet de l&apos;élève</label>
        <input
          className="input mt-1"
          required
          value={form.student_full_name}
          onChange={(e) => setForm({ ...form, student_full_name: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Date de naissance</label>
        <input
          type="date"
          className="input mt-1"
          value={form.student_birthdate}
          onChange={(e) => setForm({ ...form, student_birthdate: e.target.value })}
        />
      </div>

      <hr className="my-3 border-slate-100" />

      <div>
        <label className="text-sm font-medium text-slate-700">Nom complet du parent/tuteur</label>
        <input
          className="input mt-1"
          required
          value={form.parent_full_name}
          onChange={(e) => setForm({ ...form, parent_full_name: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Téléphone (WhatsApp)</label>
        <input
          className="input mt-1"
          required
          placeholder="+225 07 00 00 00 00"
          value={form.parent_phone}
          onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Email (optionnel)</label>
        <input
          type="email"
          className="input mt-1"
          value={form.parent_email}
          onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
        {loading ? "Traitement..." : "Continuer vers le paiement"}
      </button>
    </form>
  );
}
