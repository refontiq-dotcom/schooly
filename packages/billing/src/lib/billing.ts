/**
 * @refontiq/billing — Service principal
 * Moteur de facturation mutualisé pour l'écosystème Refontiq
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingConfig,
  BillingMode,
  SubscriptionPaymentRequest,
  PlatformFeeLedgerEntry,
  PlatformInvoice,
  ProductBillingConfig,
  SubscriptionAlertData,
  EventBillingAlertData,
  BillingValidationResult,
} from "../types";
import {
  isTelegramConfigured,
  sendTelegramMessage,
  formatSubscriptionAlert,
  formatEventBillingAlert,
  getTelegramAdminUrl,
} from "./telegram";

// Configuration Supabase (à initialiser par le produit consommateur)
let supabaseAdmin: SupabaseClient | null = null;

export function initBilling(supabaseUrl: string, serviceRoleKey: string): void {
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error("Billing non initialisé. Appelez initBilling() d'abord.");
  }
  return supabaseAdmin;
}

// ============================================================================
// 1. CONFIGURATION PRODUIT
// ============================================================================

export async function getProductConfig(productId: string): Promise<ProductBillingConfig | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("billing_configs")
    .select("*")
    .eq("product_id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    product_id: data.product_id,
    name: data.name,
    mode: data.mode as BillingMode,
    currency: data.currency,
    tiers: data.tiers as any,
    event_amount: data.event_amount,
    event_types: data.event_types as any,
    wave_merchant_id: data.wave_merchant_id,
    wave_webhook_secret: data.wave_webhook_secret,
    telegram_bot_token: data.telegram_bot_token,
    telegram_chat_id: data.telegram_chat_id,
    telegram_admin_url: data.telegram_admin_url,
  };
}

export async function upsertProductConfig(config: ProductBillingConfig): Promise<void> {
  const admin = getAdmin();
  const { error } = await admin.from("billing_configs").upsert({
    product_id: config.product_id,
    name: config.name,
    mode: config.mode,
    currency: config.currency,
    tiers: config.tiers,
    event_amount: config.event_amount,
    event_types: config.event_types,
    wave_merchant_id: config.wave_merchant_id,
    wave_webhook_secret: config.wave_webhook_secret,
    telegram_bot_token: config.telegram_bot_token,
    telegram_chat_id: config.telegram_chat_id,
    telegram_admin_url: config.telegram_admin_url,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "product_id" });

  if (error) throw error;
}

// ============================================================================
// 2. MODE SUBSCRIPTION_TIERS (Séjoura)
// ============================================================================

export async function createSubscriptionPaymentRequest(params: {
  productId: string;
  tenantId: string;
  subscriptionId?: string;
  tierId: string;
  amount: number;
  requestedBy?: string;
  senderPhone: string;
  paymentProvider?: string;
  notes?: string;
}): Promise<SubscriptionPaymentRequest> {
  const admin = getAdmin();
  
  // Vérifier s'il y a déjà une demande en attente pour ce tenant
  const { data: existing } = await admin
    .from("subscription_payment_requests")
    .select("id")
    .eq("product_id", params.productId)
    .eq("tenant_id", params.tenantId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    throw new Error("PENDING_REQUEST_EXISTS: Une demande est déjà en attente pour cet établissement");
  }

  const { data, error } = await admin
    .from("subscription_payment_requests")
    .insert({
      product_id: params.productId,
      tenant_id: params.tenantId,
      subscription_id: params.subscriptionId,
      tier_id: params.tierId,
      amount: params.amount,
      status: "pending",
      requested_by: params.requestedBy,
      sender_phone: params.senderPhone,
      payment_provider: params.paymentProvider || "wave",
      notes: params.notes,
    })
    .select()
    .single();

  if (error || !data) throw error || new Error("Failed to create payment request");

  // Alerte Telegram
  await sendSubscriptionValidationAlert(params.productId, data.id);

  return data as SubscriptionPaymentRequest;
}

export async function validateSubscriptionPayment(
  requestId: string,
  validatorId: string
): Promise<BillingValidationResult> {
  const admin = getAdmin();
  
  const { data, error } = await admin.rpc("validate_subscription_payment", {
    p_request_id: requestId,
    p_validator_id: validatorId,
  });

  if (error) throw error;
  
  return { success: true, message: "Paiement validé", request: data as SubscriptionPaymentRequest };
}

export async function rejectSubscriptionPayment(
  requestId: string,
  validatorId: string
): Promise<BillingValidationResult> {
  const admin = getAdmin();
  
  const { data, error } = await admin.rpc("reject_subscription_payment", {
    p_request_id: requestId,
    p_validator_id: validatorId,
  });

  if (error) throw error;
  
  return { success: true, message: "Paiement rejeté", request: data as SubscriptionPaymentRequest };
}

export async function getPendingSubscriptionRequests(productId: string): Promise<SubscriptionPaymentRequest[]> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("subscription_payment_requests")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SubscriptionPaymentRequest[];
}

// Alerte Telegram pour nouvelle demande de validation
async function sendSubscriptionValidationAlert(productId: string, requestId: string): Promise<void> {
  const admin = getAdmin();
  
  // Récupérer la demande avec infos tenant
  const { data: request } = await admin
    .from("subscription_payment_requests")
    .select(`
      *,
      tenants!inner(company_name, contact_name)
    `)
    .eq("id", requestId)
    .single();

  if (!request) return;

  const config = await getProductConfig(productId);
  if (!config || !isTelegramConfigured(config.telegram_bot_token, config.telegram_chat_id)) return;

  const tenant = (request as any).tenants;
  const adminUrl = getTelegramAdminUrl(
    `https://${productId}.refontiq.com/admin`,
    config.telegram_admin_url
  );

  const alertData: SubscriptionAlertData = {
    productName: config.name,
    tenantName: tenant?.company_name || "Établissement inconnu",
    contactName: tenant?.contact_name || "Gérant",
    tierLabel: request.tier_id || "Plan",
    amount: request.amount,
    senderPhone: request.sender_phone || "—",
    adminUrl,
    paymentProvider: request.payment_provider as any,
  };

  const text = formatSubscriptionAlert(alertData);
  await sendTelegramMessage(text, config.telegram_bot_token!, config.telegram_chat_id!);
}

// ============================================================================
// 3. MODE EVENT_BASED (Schooly)
// ============================================================================

export async function recordBillableEvent(params: {
  productId: string;
  eventId: string;
  tenantId: string;
  eventType: string;
  amount?: number;
  academicYearId?: string;
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<PlatformFeeLedgerEntry> {
  const admin = getAdmin();
  
  const { data, error } = await admin.rpc("record_billable_event", {
    p_product_id: params.productId,
    p_event_id: params.eventId,
    p_tenant_id: params.tenantId,
    p_event_type: params.eventType,
    p_amount: params.amount,
    p_academic_year_id: params.academicYearId,
    p_period_label: params.periodLabel,
    p_period_start: params.periodStart,
    p_period_end: params.periodEnd,
  });

  if (error) throw error;
  return data as PlatformFeeLedgerEntry;
}

export async function getPlatformFeeLedger(
  productId: string,
  filters?: { tenantId?: string; status?: string; periodLabel?: string }
): Promise<PlatformFeeLedgerEntry[]> {
  const admin = getAdmin();
  let query = admin
    .from("platform_fee_ledger")
    .select("*")
    .eq("product_id", productId);

  if (filters?.tenantId) query = query.eq("tenant_id", filters.tenantId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.periodLabel) query = query.eq("period_label", filters.periodLabel);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PlatformFeeLedgerEntry[];
}

export async function generatePlatformInvoices(
  productId: string,
  periodLabel: string,
  periodStart: string,
  periodEnd: string
): Promise<PlatformInvoice[]> {
  const admin = getAdmin();
  
  const { data, error } = await admin.rpc("generate_platform_invoices", {
    p_product_id: productId,
    p_period_label: periodLabel,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) throw error;
  return (data || []) as PlatformInvoice[];
}

export async function markFeesCollected(
  productId: string,
  tenantId: string,
  periodLabel: string,
  paidAmount: number
): Promise<number> {
  const admin = getAdmin();
  
  const { data, error } = await admin.rpc("mark_fees_collected", {
    p_product_id: productId,
    p_tenant_id: tenantId,
    p_period_label: periodLabel,
    p_paid_amount: paidAmount,
  });

  if (error) throw error;
  return data as number;
}

export async function getPlatformInvoices(
  productId: string,
  filters?: { tenantId?: string; status?: string }
): Promise<PlatformInvoice[]> {
  const admin = getAdmin();
  let query = admin
    .from("platform_invoices")
    .select("*")
    .eq("product_id", productId);

  if (filters?.tenantId) query = query.eq("tenant_id", filters.tenantId);
  if (filters?.status) query = query.eq("status", filters.status);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PlatformInvoice[];
}

// ============================================================================
// 4. HELPERS COMMUNS
// ============================================================================

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { 
    style: "currency", 
    currency: "XOF", 
    minimumFractionDigits: 0 
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric" 
  });
}
