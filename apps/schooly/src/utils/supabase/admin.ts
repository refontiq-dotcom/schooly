import { createClient } from "@supabase/supabase-js"

/**
 * Client Supabase avec la clé service_role : bypasse la RLS.
 * Usage réservé aux Server Actions/Route Handlers, jamais côté client.
 * Ne jamais exposer SUPABASE_SECRET_KEY au bundle client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
