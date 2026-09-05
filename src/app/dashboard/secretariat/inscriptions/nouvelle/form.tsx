"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Level = { id: string; name: string; rank: number };
type Modality = { modality: string; name: string; required_documents: string[] | null };

const DOC_LABELS: Record<string, string> = {
  acte_naissance: "Acte de naissance",
  photo_identite: "Photo d'identité",
  carnet_vaccination: "Carnet de vaccination",
  bulletin_precedent: "Bulletin précédent",
  certificat_scolarite: "Certificat de scolarité",
  piece_identite: "Pièce d'identité du parent/tuteur",
  dossier_examen: "Dossier d'examen",
  autre: "Autre document",
};

export function PhysicalEnrollmentForm({ levels, modalities }: { levels: Level[]; modalities: Modality[] }) {
  const router = useRouter();
  const [modality, setModality] = useState(modalities[0]?.modality ?? "standard");
  const [provided, setProvided] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => modalities.find((m) => m.modality === modality), [modalities, modality]);

  function toggleDocument(doc: string) {
    setProvided((current) => current.includes(doc) ? current.filter((x) => x !== doc) : [...current, doc]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/enrollment/physical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level_id: form.get("level_id"),
        student_full_name: form.get("student_full_name"),
        student_birthdate: form.get("student_birthdate") || null,
        parent_full_name: form.get("parent_full_name"),
        parent_phone: form.get("parent_phone"),
        parent_email: form.get("parent_email") || null,
        modality,
        provided_documents: provided,
      }),
    });
    const result = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(result?.error ?? "Impossible de créer le dossier.");
      return;
    }
    router.push(`/dashboard/secretariat/inscriptions?created=${encodeURIComponent(result.application?.id ?? "")}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy">1. Élève</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Nom complet
            <input name="student_full_name" required className="input mt-1" placeholder="Nom et prénoms" />
          </label>
          <label className="text-sm font-medium text-slate-700">Date de naissance
            <input name="student_birthdate" type="date" className="input mt-1" />
          </label>
          <label className="text-sm font-medium text-slate-700">Niveau demandé
            <select name="level_id" required className="input mt-1">
              <option value="">Sélectionner</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy">2. Parent ou tuteur</h2>
        <p className="mt-1 text-xs text-slate-500">Ce numéro pourra être utilisé plus tard pour accéder à l'espace parent par OTP.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Nom du parent / tuteur
            <input name="parent_full_name" required className="input mt-1" placeholder="Nom complet" />
          </label>
          <label className="text-sm font-medium text-slate-700">Téléphone
            <input name="parent_phone" required type="tel" className="input mt-1" placeholder="+225 07 00 00 00 00" />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Email (facultatif)
            <input name="parent_email" type="email" className="input mt-1" placeholder="parent@example.com" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy">3. Modalité d'inscription</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {modalities.map((item) => (
            <label key={item.modality} className={`cursor-pointer rounded-xl border p-4 ${modality === item.modality ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
              <input type="radio" name="modality_choice" value={item.modality} checked={modality === item.modality} onChange={() => { setModality(item.modality); setProvided([]); }} className="sr-only" />
              <span className="font-medium text-slate-800">{item.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">4. Documents fournis</h2>
            <p className="mt-1 text-xs text-slate-500">Cochez uniquement les documents réellement remis au guichet. Aucun scan n'est demandé.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{provided.length}/{selected?.required_documents?.length ?? 0}</span>
        </div>
        <div className="mt-4 space-y-2">
          {(selected?.required_documents ?? []).map((doc) => (
            <label key={doc} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <input type="checkbox" checked={provided.includes(doc)} onChange={() => toggleDocument(doc)} className="h-4 w-4" />
              <span className="text-sm text-slate-700">{DOC_LABELS[doc] ?? doc}</span>
              {provided.includes(doc) && <span className="ml-auto text-xs font-semibold text-emerald-700">Fourni</span>}
            </label>
          ))}
          {(selected?.required_documents ?? []).length === 0 && <p className="text-sm text-slate-400">Aucun document obligatoire configuré pour cette modalité.</p>}
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Création du dossier…" : "Créer le dossier d'inscription"}
      </button>
    </form>
  );
}
