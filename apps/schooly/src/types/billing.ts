export type PaymentRequestStatus = "pending" | "validated" | "rejected";
export type PaymentProvider = "wave" | "orange_money" | "mtn_momo" | "moov_money" | "especes" | "virement_bancaire" | "cheque";

export interface SubscriptionPaymentRequest {
  id: string;
  product_id: string;
  tenant_id: string;
  subscription_id?: string | null;
  tier_id?: string | null;
  event_type?: string | null;
  amount: number;
  status: PaymentRequestStatus;
  requested_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  sender_phone: string | null;
  payment_provider: PaymentProvider;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
