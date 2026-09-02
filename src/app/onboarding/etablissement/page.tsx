"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createEstablishment } from "@/lib/auth/actions";
import type { SchoolType } from "@/types";
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ICONS, SCHOOL_LEVEL_PRESETS } from "@/types";

const SCHOOL_TYPES: SchoolType[] = ["primaire", "college", "lycee", "professionnel", "islamique"];

export default function CreateEstablishmentPage() {
  const [selectedType, setSelectedType] = useState<SchoolType | null>(null);
  const [error, action, pending] = useActionState(createEstablishment, null);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Créer un établissement</h1>
          <p className="text-sm text-slate-500 mt-1">
            Votre compte passera au rôle administrateur et sera rattaché à cet
            établissement.
          </p>
        </div>

        <form action={action} className="space-y-6">
          {/* ── Type d'établissement ── */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-3">
              Type d&apos;établissement
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCHOOL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selectedType === type
                      ? "border-amber-400 bg-amber-50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-2xl">{SCHOOL_TYPE_ICONS[type]}</span>
                  <div>
                    <p className={`text-sm font-semibold ${selectedType === type ? "text-amber-700" : "text-slate-700"}`}>
                      {SCHOOL_TYPE_LABELS[type]}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {SCHOOL_LEVEL_PRESETS[type].slice(0, 3).join(", ")}…
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {/* Hidden input for form submission */}
            {selectedType && <input type="hidden" name="school_type" value={selectedType} />}
          </div>

          {/* ── Niveaux prédéfinis (aperçu) ── */}
          {selectedType && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Niveaux prédéfinis — {SCHOOL_TYPE_LABELS[selectedType]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SCHOOL_LEVEL_PRESETS[selectedType].map((level) => (
                  <span
                    key={level}
                    className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg"
                  >
                    {level}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Ces niveaux seront proposés lors de la configuration des classes. Vous pourrez les modifier.
              </p>
            </div>
          )}

          {/* ── Infos de base ── */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nom de l&apos;établissement</label>
              <input name="name" className="input mt-1" required placeholder="Ex: Groupe Scolaire Les Lauréats" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Ville</label>
                <input name="city" className="input mt-1" required placeholder="Ex: Abidjan" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Adresse (optionnel)</label>
                <input name="address" className="input mt-1" placeholder="Rue, quartier" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Description (optionnel)</label>
              <textarea name="description" className="input mt-1 min-h-[80px]" placeholder="Présentation courte de l'établissement" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !selectedType}
            className="btn-primary w-full disabled:opacity-40"
          >
            {pending ? "Création…" : "Créer et devenir administrateur"}
          </button>
        </form>
      </div>
    </div>
  );
}
