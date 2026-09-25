"use server"

import crypto from "crypto"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { revalidatePath, unstable_cache, updateTag } from "next/cache"
import { CASHIER_ROLES, PRICING_ROLES } from "@/utils/supabase/roles"
import { recordPayment } from "@/lib/record-payment"
import { parseForm } from "@/lib/schemas/parse-form"
import { paymentActionSchema } from "@/lib/schemas/finance"
import {
  DIRECTION_DASHBOARD_CACHE_TAG,
  PAYMENTS_CACHE_TAG,
  READ_CACHE_TTL_SECONDS,
} from "@/lib/cache-tags"
import {
  buildPageResult,
  pageRange,
  resolvePageRequest,
  type PageRequestOptions,
} from "@/lib/pagination"
import { logServerEvent } from "@/lib/server-logger"
import { denial, requireSchoolRole } from "@/utils/supabase/require-role"
import type { ActionResult } from "./_shared"

// ============================================ PAIEMENTS ========================

export async function getPayments(
  schoolId: string,
  opts?: PageRequestOptions
) {
  const supabase = await createClient()
  const request = resolvePageRequest(opts)

  const guard = await requireSchoolRole(supabase, { requestedSchoolId: schoolId })
  if (!guard.ok) {
    // Contrat uniforme : toutes les branches renvoient les métadonnées de
    // page pour que les appelants puissent les déstructurer sans garde.
    return {
      error: denial(guard.reason, []).error,
      ...buildPageResult([], 0, request),
    }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // S2 : pagination optionnelle en base (compat : sans `opts`, liste
  // complète) — `.range()` + `count` exact, pageSize borné à 100.
  //
  // P1-B : liste mise en cache (clé : école + page), purgée par tag à chaque
  // encaissement / annulation (`updateTag`), TTL de sécurité en secours.
  // Le client `admin` reste dans la fermeture (non sérialisable).
  const loadPayments = unstable_cache(
    async () => {
      let query = admin
        .from("payments")
        // `count: "exact"` est indispensable : sans lui PostgREST renvoie
        // `count: null`, le total retombe sur la taille de la page et
        // `totalPages` vaut toujours 1 — aucun lien vers la page suivante.
        .select(
          `
      *,
      enrollments (
        matricule,
        students ( first_name, last_name ),
        guardians ( full_name, phone )
      ),
      users ( full_name )
    `,
          { count: "exact" }
        )
        .eq("school_id", guard.context.schoolId)
        .is("deleted_at", null)
        .order("received_at", { ascending: false })

      if (request.wantsPagination) {
        const { from, to } = pageRange(request)
        query = query.range(from, to)
      }

      return await query
    },
    [
      "payments",
      guard.context.schoolId,
      request.wantsPagination ? `p${request.page}s${request.pageSize}` : "all",
    ],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [PAYMENTS_CACHE_TAG] }
  )

  const { data, error, count } = await loadPayments()

  if (error) {
    return { error: error.message, ...buildPageResult([], 0, request) }
  }
  return buildPageResult(data || [], count, request)
}

export async function createPayment(formData: FormData): Promise<ActionResult<{ receiptNumber: string; verificationCode: string; balanceAfter: number | null }>> {
  const supabase = await createClient()

  // Encaissement : direction / compta / caisse uniquement.
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...CASHIER_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId, userId } = guard.context

  // P1-A : validation zod (montant FCFA strict, méthode enum, uuid) — les
  // valeurs incohérentes sont refusées avec un message lisible avant tout SQL.
  const parsed = parseForm(paymentActionSchema, formData)
  if (!parsed.ok) return { error: parsed.error }
  const { enrollmentId, amount, paymentMethod, reference, allowOverpay } = parsed.data

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // P0-2 : écriture atomique + idempotente via la RPC `record_payment`
  // (remplace les 5 requêtes + le double insert payment→receipt).
  // Clé serveur par appel : un retry réseau rejoue la même clé.
  // requireCashSession=true : discipline de clôture (cash sans session refusé).
  const outcome = await recordPayment(admin, {
    schoolId,
    enrollmentId,
    amount,
    paymentMethod,
    reference,
    cashSessionId: null,
    receivedBy: userId,
    idempotencyKey: crypto.randomUUID(),
    allowOverpay,
    requireCashSession: true,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
  })

  if (!outcome.ok) {
    // R1 : trace de refus d'encaissement (sans donnée perso — ids + motif).
    logServerEvent("warn", "payment.rejected", {
      schoolId,
      enrollmentId,
      amount,
      reason: outcome.error,
    })
    return { error: outcome.error }
  }

  logServerEvent("info", "payment.created", {
    schoolId,
    enrollmentId,
    amount,
    paymentMethod,
    receiptNumber: outcome.row.receipt_number,
  })

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/direction/finance")
  // P1-B : purge immédiate des listes cachées (Data Cache) — read-your-own-writes.
  updateTag(PAYMENTS_CACHE_TAG)
  updateTag(DIRECTION_DASHBOARD_CACHE_TAG)
  return {
    data: {
      receiptNumber: outcome.row.receipt_number,
      verificationCode: outcome.row.verification_code,
      balanceAfter: outcome.row.balance_after,
    },
  }
}

// ============================================ ANNULATION PAIEMENT ===============

/**
 * Annule un encaissement (erreur de saisie) : soft delete + motif OBLIGATOIRE.
 * La ligne reste en base pour l'audit ; les soldes se recalculent seuls (les
 * vues excluent deleted_at).
 */
export async function cancelPayment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // Annulation d'argent : direction / compta uniquement (pas la caisse).
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...PRICING_ROLES] })
  if (!guard.ok) return { error: denial(guard.reason, []).error }
  const { schoolId } = guard.context

  const paymentId = formData.get("paymentId") as string
  const reason = (formData.get("cancelReason") as string)?.trim()

  if (!paymentId) return { error: "Paiement introuvable." }
  if (!reason || reason.length < 5) {
    return { error: "Un motif d'au moins 5 caractères est obligatoire pour annuler un encaissement." }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: payment } = await admin
    .from("payments")
    .select("id, deleted_at")
    .eq("id", paymentId)
    .eq("school_id", schoolId)
    .maybeSingle()

  if (!payment) return { error: "Paiement introuvable dans cet établissement." }
  if (payment.deleted_at) return { error: "Ce paiement est déjà annulé." }

  const now = new Date().toISOString()
  const { error: payError } = await admin
    .from("payments")
    .update({ deleted_at: now, cancel_reason: reason })
    .eq("id", paymentId)

  if (payError) {
    logServerEvent("error", "payment.cancel_failed", { schoolId, paymentId, reason })
    return { error: payError.message }
  }

  logServerEvent("info", "payment.cancelled", { schoolId, paymentId, reason })

  // Le reçu correspondant est invalidé : la page publique /verify le signale.
  await admin
    .from("receipts")
    .update({ deleted_at: now })
    .eq("payment_id", paymentId)
    .is("deleted_at", null)

  revalidatePath("/dashboard/caisse")
  revalidatePath("/dashboard/caisse/history")
  revalidatePath("/dashboard/direction/finance")
  // P1-B : purge immédiate des listes cachées (Data Cache) — read-your-own-writes.
  updateTag(PAYMENTS_CACHE_TAG)
  updateTag(DIRECTION_DASHBOARD_CACHE_TAG)
  return {}
}
