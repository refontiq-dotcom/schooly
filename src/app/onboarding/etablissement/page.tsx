"use client";

import { useActionState } from "react";
import { createEstablishment } from "@/lib/auth/actions";

export default function CreateEstablishmentPage() {
  const [error, action, pending] = useActionState(createEstablishment, null);

  return (
    <div className="max-w-lg mx-auto">
      <div className="card space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-navy">Créer un établissement</h1>
          <p className="text-sm text-slate-500 mt-1">
            Votre compte passera au rôle administrateur et sera rattaché à cet
            établissement. Le personnel (professeurs, secrétariat) sera ensuite
            invité depuis le tableau de bord.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Nom de l&apos;établissement</label>
            <input name="name" className="input mt-1" required placeholder="Ex: Groupe Scolaire Les Lauréats" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Ville</label>
            <input name="city" className="input mt-1" required placeholder="Ex: Abidjan — Yopougon" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Adresse (optionnel)</label>
            <input name="address" className="input mt-1" placeholder="Rue, quartier" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description (optionnel)</label>
            <textarea name="description" className="input mt-1 min-h-[90px]" placeholder="Présentation courte" />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 border border-red-100">
              {error}
            </div>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Création…" : "Créer et devenir administrateur"}
          </button>
        </form>
      </div>
    </div>
  );
}
