"use client";

import { PaymentSubmissionForm } from "./PaymentSubmissionForm";
import { createSubscriptionPaymentRequest } from "@/app/dashboard/billing/actions";

interface PaymentSubmissionFormClientProps {
  amount: number;
  schoolId: string;
}

export function PaymentSubmissionFormClient({ amount, schoolId }: PaymentSubmissionFormClientProps) {
  return (
    <PaymentSubmissionForm
      productId="schooly"
      productName="Schooly"
      tierId="school_event_based"
      tierLabel="Événement Schooly"
      amount={amount}
      onSubmit={async (data) => {
        const formData = new FormData()
        formData.set("amount", amount.toString())
        formData.set("senderPhone", data.senderPhone)
        if (data.notes) formData.set("notes", data.notes)

        const res = await createSubscriptionPaymentRequest(formData)
        if ("error" in res && res.error) throw new Error(res.error)
      }}
    />
  );
}
