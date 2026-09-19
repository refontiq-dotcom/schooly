import { initBilling } from '@/lib/formatters';

export function initBillingClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variables d\'environnement Supabase manquantes');
  }
  
  initBilling(supabaseUrl, serviceRoleKey);
}

// Initialisation côté serveur (Server Actions, API Routes)
export function initBillingServer() {
  initBillingClient();
}
