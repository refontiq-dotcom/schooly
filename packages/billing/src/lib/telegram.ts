/**
 * @refontiq/billing — Utilitaire Telegram
 * Alertes gratuites/illimitées pour Super Admin
 */

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]`\\])/g, "\\$1");
}

export function isTelegramConfigured(botToken?: string, chatId?: string): boolean {
  return Boolean(botToken && chatId);
}

export function getTelegramAdminUrl(fallback: string, customUrl?: string): string {
  return customUrl || fallback;
}

export async function sendTelegramMessage(
  text: string,
  botToken: string,
  chatId: string
): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  return res.ok;
}

// Types pour les alertes
export interface SubscriptionAlertData {
  productName: string;
  tenantName: string;
  contactName: string;
  tierLabel: string;
  amount: number;
  senderPhone: string;
  adminUrl: string;
  paymentProvider?: string;
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

export function formatSubscriptionAlert(data: SubscriptionAlertData): string {
  const { productName, tenantName, contactName, tierLabel, amount, senderPhone, adminUrl } = data;
  const formatFCFA = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(n);
  
  return [
    "🔔 *Nouvelle demande de paiement " + escapeMarkdown(productName) + " !*",
    "",
    "🏢 *Établissement :* " + escapeMarkdown(tenantName),
    "👤 *Contact :* " + escapeMarkdown(contactName),
    "📦 *Formule :* " + escapeMarkdown(tierLabel),
    "💰 *Montant :* " + formatFCFA(amount),
    "📱 *Numéro " + (data.paymentProvider === "wave" ? "Wave" : data.paymentProvider) + " :* " + escapeMarkdown(senderPhone),
    "",
    "🔗 [Valider sur le Dashboard Admin](" + adminUrl + ")",
  ].join("\n");
}

export function formatEventBillingAlert(data: EventBillingAlertData): string {
  const { productName, tenantName, eventType, eventCount, totalAmount, periodLabel, adminUrl } = data;
  const formatFCFA = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(n);
  
  return [
    "📊 *Nouvelle facture " + escapeMarkdown(productName) + " générée*",
    "",
    "🏢 *Établissement :* " + escapeMarkdown(tenantName),
    "📅 *Période :* " + escapeMarkdown(periodLabel),
    "📝 *Événements :* " + eventCount + " (" + escapeMarkdown(eventType) + ")",
    "💰 *Total dû :* " + formatFCFA(totalAmount),
    "",
    "🔗 [Voir sur le Dashboard Admin](" + adminUrl + ")",
  ].join("\n");
}
