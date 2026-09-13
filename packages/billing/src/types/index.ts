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
  price: number; // en FCFA (entier)
  wave_pay_link?: string;
  description?: string;
}

export interface BillingConfig {
  mode: BillingMode;
  product_id: string; // ex: "sejoura", "schooly"
  
  // Mode subscription_tiers
  tiers?: SubscriptionTier[];
  
  // Mode event_based
  event_amount?: number; // montant par événement (ex: 1000 FCFA)
  event_types?: string[]; // types d'événements facturables
  
  // Commun
  currency: "XOF";
  telegram_configured: boolean;
}

export interface SubscriptionPaymentRequest {
  id: string;
  product_id: string;
  tenant_id: string; // school_id pour Schooly, tenant_id pour Séjoura
  subscription_id?: string | null;
  tier_id?: string | null; // plan pour subscription_tiers
  event_type?: string | null; // pour event_based
  amount: number; // en FCFA
  status: PaymentRequestStatus;
  requested_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  sender_phone: string | null;
  payment_provider: PaymentProvider;
  reference: string | null; // référence de paiement (ex: Wave transaction ID)
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformFeeLedgerEntry {
  id: string;
  product_id: string;
  event_id: string; // enrollment_id pour Schooly, etc.
  tenant_id: string; // school_id / tenant_id
  event_type: string; // 'enrollment_confirmed', 'booking_created', etc.
  amount: number; // en FCFA
  status: "due" | "collected" | "settled";
  period_label?: string; // ex: "T1 2026-2027"
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

// Configuration par produit (stockée en base ou en env)
export interface ProductBillingConfig {
  product_id: string;
  name: string;
  mode: BillingMode;
  currency: "XOF";
  
  // Mode subscription_tiers
  tiers?: SubscriptionTier[];
  
  // Mode event_based
  event_amount?: number;
  event_types?: string[];
  
  // Wave / Mobile Money
  wave_merchant_id?: string;
  wave_webhook_secret?: string;
  
  // Telegram
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  telegram_admin_url?: string;
}

// Résultat d'une validation/rejet
export interface BillingValidationResult {
  success: boolean;
  message: string;
  request?: SubscriptionPaymentRequest;
}

// Pour l'API de push de métriques
export interface MetricsPushPayload {
  product_id: string;
  name: string;
  mrr: number;
  active_tenants: number;
  health_status: "healthy" | "warning" | "critical" | "unknown";
}

// Alertes Telegram
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
