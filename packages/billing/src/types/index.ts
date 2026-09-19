/**
 * @refontiq/billing — Types partagés
 * 
 * Moteur de facturation mutualisé pour tous les produits Refontiq.
 * Deux modes de calcul :
 * 1. "subscription_tiers" — montant fixe par plan (Séjoura)
 * 2. "event_based" — montant par événement métier (Schooly: 1000 FCFA/inscription)
 */

export type BillingMode = "subscription_tiers" | "event_based";

export type PaymentProvider = "wave" | "orange_money" | "mtn_money" | "moov_money" | "pi_spi" | "manual";

export type PaymentRequestStatus = "pending" | "validated" | "rejected" | "cancelled";

export interface SubscriptionTier {
  id: string;
  label: string;
  price: number;
  wave_pay_link?: string;
  description?: string;
}

export interface BillingConfig {
  mode: BillingMode;
  product_id: string;
  tiers?: SubscriptionTier[];
  event_amount?: number;
  event_types?: string[];
  currency: "XOF";
  telegram_configured: boolean;
}

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

export interface PlatformFeeLedgerEntry {
  id: string;
  product_id: string;
  event_id: string;
  tenant_id: string;
  event_type: string;
  amount: number;
  status: "due" | "collected" | "settled";
  period_label?: string;
  period_start?: string;
  period_end?: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformInvoice {
  id: string;
  product_id: string;
  tenant_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  total_events: number;
  total_due: number;
  status: "pending" | "paid" | "overdue";
  created_at: string;
  updated_at: string;
}

export interface ProductBillingConfig {
  product_id: string;
  name: string;
  mode: BillingMode;
  currency: "XOF";
  tiers?: SubscriptionTier[];
  event_amount?: number;
  event_types?: string[];
  wave_merchant_id?: string;
  wave_webhook_secret?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  telegram_admin_url?: string;
}

export interface BillingValidationResult {
  success: boolean;
  message: string;
  request?: SubscriptionPaymentRequest;
}

/**
 * Contrat canonique Schooly → Refontiq Control Center.
 * Le nom des champs suit directement le schéma portfolio_metrics.
 */
export interface MetricsPushPayload {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: "healthy" | "warning" | "critical" | "unknown";
}

export interface SubscriptionAlertData {
  productName: string;
  tenantName: string;
  contactName: string;
  tierLabel: string;
  amount: number;
  senderPhone: string;
  adminUrl: string;
  paymentProvider?: PaymentProvider;
}

export interface EventBillingAlertData {
  productName: string;
  tenantName: string;
  eventType: string;
  eventCount: number;
  totalAmount: number;
  periodLabel: string;
  adminUrl: string;
}
