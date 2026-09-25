"use server"

import { createClient as createAdminClient } from "@supabase/supabase-js"

// ============================================ VÉRIFICATION PUBLIQUE ==============

/**
 * EXCEPTION VOLONTAIRE — pas de garde requireSchoolRole ici.
 * Appelée par le tunnel public `/verify/[code]` (page de vérification d'un reçu
 * par quiconque possède le lien QR imprimé sur le reçu). L'authentification
 * casserait ce tunnel. Le secret réside dans le code lui-même : 128 bits
 * d'aléa (`crypto.randomBytes(16)`), impossible à énumérer. Les données
 * retournées sont limitées au contenu du reçu (pas de liste ni de balayage).
 * Cf. docs/security/audit-socle-auth-tenancy.md — module Finance.
 */
export async function verifyReceipt(verificationCode: string) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: receipt } = await admin
    .from("receipts")
    .select(`
      *,
      payments (
        amount,
        payment_method,
        reference,
        received_at,
        enrollments (
          matricule,
          students ( first_name, last_name ),
          guardians ( full_name, phone )
        )
      ),
      schools ( name, city )
    `)
    .eq("verification_code", verificationCode.toUpperCase())
    .is("deleted_at", null)
    .single()

  if (!receipt) return { error: "Reçu introuvable.", data: null }

  return { data: receipt, error: null }
}
