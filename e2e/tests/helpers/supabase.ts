import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis pour les tests E2E",
      );
    }
    client = createClient(url, key, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });
  }
  return client;
}
