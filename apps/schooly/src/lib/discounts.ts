// ============================================================================
// lib/discounts.ts — Moteur de réductions (fratrie / bourse), pur et testé.
//
// FRATRIE : plusieurs enfants du même parent (même guardian) inscrits dans la
// même école la même année. Convention métier : le plus ancien matricule paie
// plein, les suivants reçoivent une remise dont le TAUX EST CHOISI PAR L'ÉCOLE.
// Toutes les écoles ne pratiquent pas de remise fratrie : aucune ne doit se voir
// imposer un taux implicite. L'école peut toujours ajuster ou retirer la remise
// manuellement (table fee_discounts).
//
// BOURSE : statut déclaré à l'admission (mouvement ORT) ou profil financier
// (demi-bourse…) — la réduction est créée sur décision, avec le taux voulu.
// ============================================================================

/**
 * Taux *suggéré* dans l'interface (pré-remplissage indicatif) — jamais appliqué
 * en silence : `applySiblingDiscounts` exige un taux explicite transmis par
 * l'école, et refuse l'opération si aucun n'est fourni.
 */
export const SIBLING_DEFAULT_RATE = 10

export type SiblingGroup = {
  guardianId: string
  /** Inscriptions actives du même parent dans la même école + même année. */
  enrollments: Array<{ enrollmentId: string; matricule: string | null }>
}

export type SiblingDiscountPlan = {
  enrollmentId: string
  kind: "fratrie"
  label: string
  /** Montant en FCFA : taux × attendu de CETTE inscription. */
  amount: number
  rate: number
  /** Position dans la fratrie (1 = paye plein, 2+ = remisés). */
  rank: number
}

/**
 * Calcule la remise fratrie par inscription : tri par matricule (stable —
 * les sans-matricule en fin, triés par id), le 1er paye plein, les suivants
 * reçoivent rate % de leur montant attendu.
 */
export function planSiblingDiscounts(
  group: SiblingGroup,
  expectedByEnrollment: Record<string, number>,
  rate = SIBLING_DEFAULT_RATE
): SiblingDiscountPlan[] {
  if (group.enrollments.length < 2 || rate <= 0) return []

  const ordered = [...group.enrollments].sort((a, b) => {
    const ma = a.matricule ?? `~${a.enrollmentId}`
    const mb = b.matricule ?? `~${b.enrollmentId}`
    return ma < mb ? -1 : ma > mb ? 1 : 0
  })

  return ordered
    .map((e, index) => {
      const rank = index + 1
      if (rank === 1) return null
      const expected = expectedByEnrollment[e.enrollmentId] ?? 0
      if (expected <= 0) return null
      const amount = Math.round((expected * rate) / 100)
      if (amount <= 0) return null
      return {
        enrollmentId: e.enrollmentId,
        kind: "fratrie" as const,
        label: `Remise fratrie — enfant n°${rank} (${rate} %)`,
        amount,
        rate,
        rank,
      }
    })
    .filter((p): p is SiblingDiscountPlan => p !== null)
}

export type ScholarshipInput = {
  enrollmentId: string
  /** Statut déclaré : boursier → remise, non_boursier/inconnu → rien. */
  scholarshipStatus: "boursier" | "non_boursier" | "inconnu"
  /** Attendu annuel de l'inscription (après fratrie éventuelle). */
  expectedAmount: number
  /** Taux de la bourse en % (défaut école, ex. 50 pour demi-bourse). */
  rate: number
}

export type ScholarshipPlan = {
  enrollmentId: string
  kind: "bourse"
  label: string
  amount: number
  rate: number
}

/** Calcule la remise de bourse (0 si non applicable). */
export function planScholarshipDiscount(input: ScholarshipInput): ScholarshipPlan | null {
  const { enrollmentId, scholarshipStatus, expectedAmount, rate } = input
  if (scholarshipStatus !== "boursier") return null
  if (rate <= 0 || rate > 100) return null
  if (expectedAmount <= 0) return null
  const amount = Math.round((expectedAmount * rate) / 100)
  if (amount <= 0) return null
  return {
    enrollmentId,
    kind: "bourse",
    label: `Bourse (${rate} %)`,
    amount,
    rate,
  }
}

/**
 * Garde-fou central : le total des remises ne peut jamais dépasser l'attendu
 * (une école qui empile fratrie + bourse + remise manuelle ne peut pas créer
 * un attendu négatif).
 */
export function capDiscounts(
  expectedAmount: number,
  discounts: Array<{ amount: number }>
): { capped: Array<{ amount: number }>; removed: number } {
  let remaining = expectedAmount
  const capped: Array<{ amount: number }> = []
  let removed = 0
  for (const d of discounts) {
    if (d.amount <= 0) continue
    if (remaining <= 0) {
      removed += 1
      continue
    }
    const allowed = Math.min(d.amount, remaining)
    if (allowed < d.amount) {
      capped.push({ ...d, amount: allowed })
      remaining = 0
    } else {
      capped.push(d)
      remaining -= d.amount
    }
  }
  return { capped, removed }
}
