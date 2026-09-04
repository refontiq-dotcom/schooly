"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LevelAvailability, InscriptionModality, InscriptionModalityConfig } from "@/types";
import {
  INSCRIPTION_MODALITY_LABELS,
  INSCRIPTION_MODALITY_ICONS,
  INSCRIPTION_MODALITY_COLORS,
} from "@/types";

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
  const [modalities, setModalities] = useState<InscriptionModalityConfig[]>([]);

  const [form, setForm] = useState({
    level_id: levels.find((l) => l.seats_available > 0)?.level_id ?? "",
    modality: "standard" as InscriptionModality,
    student_full_name: "",
    student_birthdate: "",
    parent_full_name: "",
    parent_phone: "",
    parent_email: "",
  });

  // Charger les modalités disponibles pour cet établissement
  useEffect(() => {
    fetch(`/api/establishments/${establishmentId}/modalities`)
      .then((res) => res.json())
      .then((data) => {
        if (data.modalities) setModalities(data.modalities);
      })
      .catch(() => {
        // Fallback : modalités par défaut si l'API n'existe pas encore
        setModalities([
          {
            id: "default",
            establishment_id: establishmentId,
            modality: "standard",
            name: "Inscription standard",
            description: "Inscription avec frais de scolarité complets",
            fee_multiplier: 1.0,
            required_documents: ["acte_naissance", "photo_identite", "bulletin_precedent"],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      });
  }, [establishmentId]);

  const selectedModality = modalities.find((m) => m.modality === form.modality);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishment_id: establishmentId,
          level_id: form.level_id,
          modality: form.modality,
          student_full_name: form.student_full_name,
          student_birthdate: form.student_birthdate || undefined,
          parent_full_name: form.parent_full_name,
          parent_phone: form.parent_phone,
          parent_email: form.parent_email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la réservation");

      router.push(`/reservation/confirmation/${data.reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Sélection de la modalité d'inscription ── */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-3 block">
          Modalité d&apos;inscription
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {modalities
            .filter((m) => m.is_active)
            .map((modality) => (
              <button
                key={modality.modality}
                type="button"
                onClick={() => setForm({ ...form, modality: modality.modality })}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  form.modality === modality.modality
                    ? "border-amber-400 bg-amber-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-2xl shrink-0">
                  {INSCRIPTION_MODALITY_ICONS[modality.modality]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {modality.name}
                  </p>
                  {modality.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {modality.description}
                    </p>
                  )}
                  {modality.fee_multiplier < 1 && (
                    <p className="text-xs font-medium text-emerald-600 mt-1">
                      {modality.fee_multiplier === 0
                        ? "✅ Gratuit"
                        : `💰 ${Math.round(modality.fee_multiplier * 100)}% du tarif`}
                    </p>
                  )}
                </div>
                {form.modality === modality.modality && (
                  <span className="text-amber-500 text-lg shrink-0">✓</span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* ── Documents requis selon la modalité ── */}
      {selectedModality?.required_documents &&
        selectedModality.required_documents.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">
              📄 Documents requis :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedModality.required_documents.map((doc) => (
                <span
                  key={doc}
                  className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600"
                >
                  {doc.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* ── Niveau ── */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Niveau souhaité
        </label>
        <select
          className="input mt-1"
          required
          value={form.level_id}
          onChange={(e) => setForm({ ...form, level_id: e.target.value })}
        >
          <option value="" disabled>
            Sélectionner un niveau
          </option>
          {levels.map((l) => (
            <option
              key={l.level_id}
              value={l.level_id}
              disabled={l.seats_available <= 0}
            >
              {l.level_name}{" "}
              {l.seats_available <= 0
                ? "(complet)"
                : `(${l.seats_available} places)`}
            </option>
          ))}
        </select>
      </div>

      {/* ── Infos élève ── */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Nom complet de l&apos;élève
        </label>
        <input
          className="input mt-1"
          required
          value={form.student_full_name}
          onChange={(e) =>
            setForm({ ...form, student_full_name: e.target.value })
          }
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Date de naissance
        </label>
        <input
          type="date"
          className="input mt-1"
          value={form.student_birthdate}
          onChange={(e) =>
            setForm({ ...form, student_birthdate: e.target.value })
          }
        />
      </div>

      <hr className="my-3 border-slate-100" />

      {/* ── Infos parent ── */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Nom complet du parent/tuteur
        </label>
        <input
          className="input mt-1"
          required
          value={form.parent_full_name}
          onChange={(e) =>
            setForm({ ...form, parent_full_name: e.target.value })
          }
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Téléphone (WhatsApp)
        </label>
        <input
          className="input mt-1"
          required
          placeholder="+225 07 00 00 00 00"
          value={form.parent_phone}
          onChange={(e) =>
            setForm({ ...form, parent_phone: e.target.value })
          }
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Email (optionnel)
        </label>
        <input
          type="email"
          className="input mt-1"
          value={form.parent_email}
          onChange={(e) =>
            setForm({ ...form, parent_email: e.target.value })
          }
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full mt-2"
      >
        {loading ? "Traitement..." : "Continuer vers le paiement"}
      </button>
    </form>
  );
}
