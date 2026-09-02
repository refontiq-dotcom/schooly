"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPayment,
  createFeeCategory,
  createSupplyList,
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
