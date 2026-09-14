export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Initialisation billing (compatibilité locale sans @refontiq/billing)
let billingConfig: { url: string; key: string } | null = null;

export function initBilling(url: string, key: string): void {
  billingConfig = { url, key };
}

export function getBillingConfig(): { url: string; key: string } | null {
  return billingConfig;
}
