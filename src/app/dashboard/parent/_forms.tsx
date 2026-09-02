"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  markDocumentStatus,
  recordPayment,
  sendMessage,
  toggleSupplyItem,
} from "@/lib/operations/actions";
import { PAYMENT_METHOD_LABEL } from "@/lib/operations/labels";
import type { PaymentMethod } from "@/types";

export function PayFeeForm({
  feeId,
  remaining,
}: {
  feeId: string;
  remaining: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, action, pending] = useActionState(recordPayment, null);
  const last = useRef(pending);

  useEffect(() => {
    if (last.current && !pending && !error) {
      formRef.current?.reset();
      router.refresh();
    }
    last.current = pending;
  }, [pending, error, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="fee_id" value={feeId} />
      <div>
        <label className="text-xs text-slate-500" htmlFor={`amount-${feeId}`}>Montant (FCFA)</label>
        <input
          id={`amount-${feeId}`}
          name="amount"
          type="number"
          min={1}
          max={remaining}
          defaultValue={remaining}
          required
          className="input"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor={`method-${feeId}`}>Mobile Money</label>
        <select id={`method-${feeId}`} name="method" className="input" defaultValue="orange_money">
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs text-slate-500" htmlFor={`ref-${feeId}`}>Référence (optionnel)</label>
        <input id={`ref-${feeId}`} name="reference" className="input" placeholder="ID transaction" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary sm:col-span-2 min-h-11">
        {pending ? "Envoi…" : "Déclarer un paiement"}
      </button>
      {error && <p className="sm:col-span-2 text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}

export function SupplyToggle({
  studentId,
  itemId,
  purchased,
}: {
  studentId: string;
  itemId: string;
  purchased: boolean;
}) {
  const [checked, setChecked] = useState(purchased);
  const [busy, setBusy] = useState(false);

  async function onChange(next: boolean) {
    setChecked(next);
    setBusy(true);
    await toggleSupplyItem(studentId, itemId, next);
    setBusy(false);
  }

  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 accent-amber-500"
        checked={checked}
        disabled={busy}
        onChange={(e) => onChange(e.target.checked)}
      />
      {checked ? "Acheté" : "À acheter"}
    </label>
  );
}

export function SubmitDocumentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-secondary text-sm min-h-11"
      onClick={async () => {
        setPending(true);
        await markDocumentStatus(id, "submitted");
        setPending(false);
        router.refresh();
      }}
    >
      {pending ? "Envoi…" : "Marquer comme déposé"}
    </button>
  );
}

export function MessageForm({
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
      <div>
        <label className="text-xs text-slate-500" htmlFor="msg-subject">Sujet</label>
        <input id="msg-subject" name="subject" required className="input" placeholder="Question sur les frais, absences…" />
      </div>
      <div>
        <label className="text-xs text-slate-500" htmlFor="msg-body">Message</label>
        <textarea id="msg-body" name="body" required className="input min-h-[110px]" placeholder="Votre message" />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary min-h-11">
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
