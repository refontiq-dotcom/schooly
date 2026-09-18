// ============================================================================
// lib/finance.ts — Helpers purs du module Finance (testés sans base).
//
// planFeeItems : découpe un montant annuel en tranches (annuel / trimestriel /
// mensuel) avec dates d'échéance réparties sur l'année scolaire. Les montants
// sont des entiers FCFA — l'arrondi est porté par la PREMIÈRE tranche pour que
// la somme des tranches soit TOUJOURS exactement le montant attendu.
// Miroir SQL : packages/db/supabase/migrations/20260918200000_finance_phase1.sql
// ============================================================================

export type FeePlan = "annuel" | "trimestriel" | "mensuel"

export type PlannedFeeItem = {
  label: string
  amount: number
  position: number
  /** Date ISO « YYYY-MM-DD » ou null */
  dueDate: string | null
}

/** Nombre de mois entiers entre deux dates ISO (bornes incluses côté fin). */
export function monthsBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00Z")
  const end = new Date(endISO + "T00:00:00Z")
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(months, 1)
}

/** Ajoute n mois à une date ISO en écrêtant le jour (31 → 28/30 selon mois). */
export function addMonthsISO(startISO: string, months: number): string {
  const d = new Date(startISO + "T00:00:00Z")
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const daysInMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate()
  d.setUTCDate(Math.min(day, daysInMonth))
  return d.toISOString().slice(0, 10)
}

/**
 * Découpe un montant en tranches.
 * - annuel      → 1 ligne, échéance = rentrée
 * - trimestriel → 3 lignes, échéances aux tiers de l'année
 * - mensuel     → 1 ligne par mois de l'année scolaire
 * La première tranche absorbe l'arrondi (montants entiers FCFA).
 */
export function planFeeItems(args: {
  totalAmount: number
  plan: FeePlan
  yearStart: string
  yearEnd: string
  yearLabel?: string | null
}): PlannedFeeItem[] {
  const { totalAmount, plan, yearStart, yearEnd, yearLabel } = args

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return []
  if (!yearStart || !yearEnd) return []

  const suffix = yearLabel ? ` ${yearLabel}` : ""
  const totalMonths = monthsBetween(yearStart, yearEnd)

  const count =
    plan === "annuel" ? 1 : plan === "trimestriel" ? 3 : Math.min(totalMonths, 12)

  if (count === 1) {
    return [
      {
        label: `Scolarité${suffix}`,
        amount: totalAmount,
        position: 1,
        dueDate: yearStart,
      },
    ]
  }

  const base = Math.floor(totalAmount / count)
  const remainder = totalAmount - base * count

  return Array.from({ length: count }, (_, i) => {
    // Échéances : début d'année + i × (mois totaux / nb tranches)
    const offset = Math.round((totalMonths * i) / count)
    return {
      label: `Tranche ${i + 1}/${count}`,
      amount: i === 0 ? base + remainder : base,
      position: i + 1,
      dueDate: addMonthsISO(yearStart, offset),
    }
  })
}
