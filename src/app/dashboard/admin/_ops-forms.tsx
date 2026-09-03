"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPayment,
  createTrouvetouAd,
  createFeeCategory,
  createSupplyList,
  finalizeReservation,
  updateEstablishment,
  markDocumentStatus,
  sendMessage,
  toggleTrouvetouPublication,
} from "@/lib/operations/actions";
import type { DocumentStatus } from "@/types";

export function FeeCategoryForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(createFeeCategory, null);
  const last = useRef(pending);
  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="text-xs text-slate-500" htmlFor="fee-name">Nom du frais</label>
        <input id="fee-name" name="name" required className="input" placeholder="Scolarité T1, cantine, transport…" />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="fee-amount">Montant (FCFA)</label>
        <input id="fee-amount" name="amount" type="number" min={0} required className="input" />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="fee-due">Échéance</label>
        <input id="fee-due" name="due_date" type="date" className="input" />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="fee-year">Année scolaire</label>
        <input id="fee-year" name="school_year" className="input" defaultValue="2026-2027" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs text-slate-500" htmlFor="fee-desc">Description</label>
        <input id="fee-desc" name="description" className="input" placeholder="Détail visible par les parents" />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary min-h-11 sm:col-span-2">
        {pending ? "Enregistrement…" : "Publier le frais"}
      </button>
    </form>
  );
}

export function TrouvetouPublicationToggle({ published }: { published: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-800">Publication sur Trouvetou</p>
        <p className="text-sm text-slate-500">
          {published ? "Votre établissement est visible et réservable." : "Votre établissement reste privé sur Trouvetou."}
        </p>
        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        aria-pressed={published}
        onClick={async () => {
          setPending(true);
          setError(await toggleTrouvetouPublication(!published));
          setPending(false);
          router.refresh();
        }}
        className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors ${published ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
      >
        {pending ? "Mise à jour…" : published ? "Désactiver" : "Publier l'établissement"}
      </button>
    </div>
  );
}

export function TrouvetouAdForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(createTrouvetouAd, null);
  const last = useRef(pending);
  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-title">Titre</label>
          <input id="trouvetou-ad-title" name="title" required className="input" placeholder="Admissions ouvertes 2026-2027" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-image">URL de la photo</label>
          <input id="trouvetou-ad-image" name="image_url" type="url" className="input" placeholder="https://..." />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-description">Message</label>
          <textarea id="trouvetou-ad-description" name="description" className="input min-h-24" placeholder="Présentez votre offre aux familles" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-target">Lien de destination</label>
          <input id="trouvetou-ad-target" name="target_url" type="url" className="input" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-start">Début</label>
          <input id="trouvetou-ad-start" name="starts_at" type="datetime-local" className="input" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="trouvetou-ad-end">Fin (facultative)</label>
          <input id="trouvetou-ad-end" name="ends_at" type="datetime-local" className="input" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary min-h-11">
        {pending ? "Création…" : "Créer la publicité"}
      </button>
    </form>
  );
}

export function EstablishmentEditForm({
  establishment,
}: {
  establishment: {
    name: string;
    city: string;
    address: string | null;
    description: string | null;
    website_url: string | null;
    cover_image_url: string | null;
    tour_360_url: string | null;
    latitude: number | null;
    longitude: number | null;
    reservation_fee_amount: number;
    reservation_hold_hours: number;
  };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(updateEstablishment, null);
  const last = useRef(pending);
  useEffect(() => {
    if (last.current && !pending && !error) router.refresh();
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-name">Nom de l'établissement</label>
          <input id="establishment-name" name="name" required defaultValue={establishment.name} className="input" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-city">Ville</label>
          <input id="establishment-city" name="city" required defaultValue={establishment.city} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500" htmlFor="establishment-address">Adresse</label>
          <input id="establishment-address" name="address" defaultValue={establishment.address ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500" htmlFor="establishment-description">Description</label>
          <textarea id="establishment-description" name="description" defaultValue={establishment.description ?? ""} className="input min-h-24" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-cover">URL de la photo</label>
          <input id="establishment-cover" name="cover_image_url" type="url" defaultValue={establishment.cover_image_url ?? ""} className="input" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-website">Site web</label>
          <input id="establishment-website" name="website_url" type="url" defaultValue={establishment.website_url ?? ""} className="input" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-tour">Visite 360°</label>
          <input id="establishment-tour" name="tour_360_url" type="url" defaultValue={establishment.tour_360_url ?? ""} className="input" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-fee">Frais de réservation (FCFA)</label>
          <input id="establishment-fee" name="reservation_fee_amount" type="number" min={0} step="0.01" defaultValue={establishment.reservation_fee_amount} className="input" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-hold">Délai de réservation (heures)</label>
          <input id="establishment-hold" name="reservation_hold_hours" type="number" min={1} step={1} defaultValue={establishment.reservation_hold_hours} className="input" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-latitude">Latitude</label>
          <input id="establishment-latitude" name="latitude" type="number" step="any" defaultValue={establishment.latitude ?? ""} className="input" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="establishment-longitude">Longitude</label>
          <input id="establishment-longitude" name="longitude" type="number" step="any" defaultValue={establishment.longitude ?? ""} className="input" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary min-h-11">
        {pending ? "Enregistrement…" : "Enregistrer les modifications"}
      </button>
    </form>
  );
}

export function SupplyListForm({ levels }: { levels: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(createSupplyList, null);
  const last = useRef(pending);
  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500" htmlFor="sl-title">Titre</label>
          <input id="sl-title" name="title" required className="input" placeholder="Liste de rentrée CP1" />
        </div>
        <div>
          <label className="text-xs text-slate-500" htmlFor="sl-level">Niveau</label>
          <select id="sl-level" name="level_id" required className="input">
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="sl-notes">Notes aux parents</label>
        <input id="sl-notes" name="notes" className="input" placeholder="Tout marquer au nom de l'élève" />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="sl-items">Articles (une ligne : nom | qté | coût)</label>
        <textarea
          id="sl-items"
          name="items"
          required
          className="input min-h-[120px] font-mono text-xs"
          placeholder={"Cahier 200 pages | 4 | 4000\nArdoise | 1 | 1500"}
        />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending || levels.length === 0} className="btn-primary min-h-11">
        {pending ? "Publication…" : "Publier la liste"}
      </button>
    </form>
  );
}

export function ConfirmPaymentButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-secondary text-xs min-h-11 px-3"
      onClick={async () => {
        await confirmPayment(id);
        router.refresh();
      }}
    >
      Confirmer
    </button>
  );
}

export function ConfirmReservationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(await finalizeReservation(id));
          setPending(false);
          router.refresh();
        }}
        className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
      >
        {pending ? "…" : "Confirmer"}
      </button>
      {error && <span className="max-w-32 text-right text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

export function ValidateDocButton({ id, status }: { id: string; status: DocumentStatus }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-secondary text-xs min-h-11 px-3"
      onClick={async () => {
        await markDocumentStatus(id, status);
        router.refresh();
      }}
    >
      {status === "validated" ? "Valider" : "Rejeter"}
    </button>
  );
}

export function StaffMessageForm({
  recipientId,
  studentId,
}: {
  recipientId: string;
  studentId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(sendMessage, null);
  const last = useRef(pending);
  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="recipient_id" value={recipientId} />
      {studentId ? <input type="hidden" name="student_id" value={studentId} /> : null}
      <input name="subject" required className="input" placeholder="Sujet" />
      <textarea name="body" required className="input min-h-[90px]" placeholder="Message aux parents" />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary min-h-11">
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
