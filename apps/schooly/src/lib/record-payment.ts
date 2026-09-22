// ============================================================================
// lib/record-payment.ts — Appelant unique de la RPC atomique record_payment.
//
// P0-2 : createPayment (finance) et collectPayment (admissions) partageaient
// la même séquence non transactionnelle (insert payment PUIS insert receipt).
// Toute écriture passe désormais par la RPC `record_payment` : atomicité
// payment+receipt, idempotence par (school_id, idempotency_key), garde solde
// et session cash côté DB. Ce module mappe les raises SQL vers les messages
// FR actuels — pur et testé, sans accès réseau.
// ============================================================================

export type RecordPaymentRow = {
  payment_id: string
  receipt_number: string
  verification_code: string
  balance_after: number | null
}

export type RecordPaymentInput = {
  schoolId: string
  enrollmentId: string
  amount: number
  paymentMethod: string
  reference: string | null
  cashSessionId: string | null
  receivedBy: string
  idempotencyKey: string
  allowOverpay: boolean
  /**
   * true (caisse/finance) : le cash exige une session ouverte, résolue côté
   * serveur. false (guichet admissions) : comportement historique — cash sans
   * session toléré, paiement non rattaché.
   */
  requireCashSession: boolean
  /** Base d'URL pour qr_code_data (reçu imprimable). Null → code seul. */
  appUrl: string | null
}

/** Chaîne PostgREST minimale : `admin.rpc(name, args)` awaitable. */
export type RpcCaller = {
  // supabase-js renvoie un PostgrestFilterBuilder (thenable, pas une vraie
  // Promise) : on exige la forme awaitable plutôt que Promise stricte pour
  // rester assignable au client réel sans cast aux sites d'appel.
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => PromiseLike<{
    data: RecordPaymentRow[] | RecordPaymentRow | null
    error: { message: string } | null
  }>
}

export type RecordPaymentOutcome =
  | { ok: true; row: RecordPaymentRow; replayed: boolean }
  | { ok: false; error: string }

const BALANCE_RE = /OVERPAY_NOT_ALLOWED:(-?\d+)/

/**
 * Mappe le message d'erreur brut de la RPC vers le message métier FR.
 * La course résiduelle (double insert concurrent même clé) est déjà absorbée
 * côté RPC (retour de l'existant) ; ce mapping couvre le cas où la violation
 * d'unicité remonte quand même (ex. clé en conflit avec un paiement
 * soft-deleted exclu du SELECT de rejeu).
 */
export function mapRecordPaymentError(raw: string, balanceIfOverpay?: number): string {
  if (raw.includes("ENROLLMENT_NOT_FOUND")) {
    return "Inscription introuvable ou accès non autorisé."
  }
  if (raw.includes("CASH_SESSION_REQUIRED")) {
    return "Ouvrez une session de caisse avant d'encaisser en espèces."
  }
  if (raw.includes("INVALID_AMOUNT")) {
    return "Le montant encaissé doit être un entier positif (FCFA)."
  }
  if (raw.includes("INVALID_PAYMENT_METHOD")) {
    return "Mode de paiement inconnu."
  }
  if (raw.includes("IDEMPOTENCY_KEY_REQUIRED")) {
    return "Clé d'idempotence manquante — rechargez le formulaire."
  }
  const overpay = BALANCE_RE.exec(raw)
  if (overpay) {
    const balance = balanceIfOverpay ?? Number(overpay[1])
    return balance > 0
      ? `Montant supérieur au solde restant (${balance.toLocaleString("fr-FR")} FCFA). Cochez « Enregistrer comme avance » si c'est volontaire.`
      : "Cet élève est déjà soldé. Cochez « Enregistrer comme avance » pour un versement volontaire."
  }
  if (raw.includes("duplicate key") || raw.includes("23505")) {
    return "Paiement déjà enregistré — vérifiez l'historique avant de réessayer."
  }
  return raw
}

export async function recordPayment(
  admin: RpcCaller,
  input: RecordPaymentInput
): Promise<RecordPaymentOutcome> {
  const { data, error } = await admin.rpc("record_payment", {
    p_school_id: input.schoolId,
    p_enrollment_id: input.enrollmentId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_reference: input.reference,
    p_cash_session_id: input.cashSessionId,
    p_received_by: input.receivedBy,
    p_idempotency_key: input.idempotencyKey,
    p_allow_overpay: input.allowOverpay,
    p_require_cash_session: input.requireCashSession,
    p_app_url: input.appUrl,
  })

  if (error) return { ok: false, error: mapRecordPaymentError(error.message) }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.payment_id) return { ok: false, error: "Encaissement refusé — réessayez." }
  return { ok: true, row, replayed: false }
}
