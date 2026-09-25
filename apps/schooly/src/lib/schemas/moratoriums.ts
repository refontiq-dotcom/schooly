// ============================================================================
// lib/schemas/moratoriums.ts — Contrats d'entrée des Server Actions moratoires.
// ============================================================================

import { z } from "zod"
import { fcfaInt, isoDate, requiredText } from "./shared"

/** POST createMoratorium — demande de moratoire sur une inscription. */
export const createMoratoriumSchema = z.object({
  enrollmentId: z.string().uuid("Inscription invalide — rechargez la page."),
  reason: requiredText("Le motif", 500).refine(
    (v) => v.length >= 5,
    "Le motif doit contenir au moins 5 caractères."
  ),
  requestedAmount: fcfaInt("Le montant demandé", { min: 1, max: 1_000_000_000, required: true }),
  dueDate: isoDate("La date limite", { allowFuture: true }),
})

/** POST decideMoratorium — approbation (échéancier) ou rejet. */
export const decideMoratoriumSchema = z.object({
  moratoriumId: z.string().uuid("Moratoire invalide."),
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "Décision inconnue (approuver ou rejeter)." }),
  }),
  // Champs absents (rejet, ou approbation au montant demandé) → undefined.
  approvedAmount: fcfaInt("Le montant approuvé", { min: 0, max: 1_000_000_000, required: false }),
  installmentCount: fcfaInt("Le nombre d'échéances", { min: 1, max: 12, required: false }),
})
