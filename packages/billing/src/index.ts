/**
 * @refontiq/billing — Moteur de facturation mutualisé
 * 
 * Deux modes :
 * - subscription_tiers : abonnement à paliers fixes (Séjoura)
 * - event_based : facturation par événement métier (Schooly - 1000 FCFA/inscription)
 * 
 * Flux commun : lien Wave → déclaration gérant → validation Super Admin → alerte Telegram
 */

// Types
export type {
  BillingMode,
  PaymentProvider,
  PaymentRequestStatus,
  SubscriptionTier,
  BillingConfig,
  SubscriptionPaymentRequest,
  PlatformFeeLedgerEntry,
  PlatformInvoice,
  ProductBillingConfig,
  SubscriptionAlertData,
  EventBillingAlertData,
  BillingValidationResult,
  MetricsPushPayload,
} from "./types";

// Lib
export {
  initBilling,
  getProductConfig,
  upsertProductConfig,
  createSubscriptionPaymentRequest,
  validateSubscriptionPayment,
  rejectSubscriptionPayment,
  getPendingSubscriptionRequests,
  recordBillableEvent,
  getPlatformFeeLedger,
  generatePlatformInvoices,
  markFeesCollected,
  getPlatformInvoices,
  formatFCFA,
  formatDate,
} from "./lib/billing";

export {
  isTelegramConfigured,
  sendTelegramMessage,
  formatSubscriptionAlert,
  formatEventBillingAlert,
} from "./lib/telegram";

// Components
// Les composants UI sont désormais dans les apps consommatrices
// export { PaymentSubmissionForm } from "./components/PaymentSubmissionForm";
// export { AdminValidationPanel } from "./components/AdminValidationPanel";

// Database schema (pour référence)
export const BILLING_SCHEMA_SQL = `-- Schéma @refontiq/billing
-- Voir packages/billing/src/db/schema.sql pour le SQL complet
-- Tables: billing_configs, subscription_payment_requests, platform_fee_ledger, platform_invoices
-- Functions: validate_subscription_payment, reject_subscription_payment, record_billable_event, generate_platform_invoices, mark_fees_collected
`;
