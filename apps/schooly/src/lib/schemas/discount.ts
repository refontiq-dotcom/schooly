import { z } from "zod"

/**
 * Remise manuelle sur une inscription (direction/compta).
 *
 * `FormData` livre des chaînes (ou `null` si le champ est absent) : on
 * coerce et on exige un entier strict — remplace le `parseInt(...) || 0`
 * qui transformait une saisie vide en remise à 0 puis en rejet flou.
 */
export const manualDiscountSchema = z.object({
  enrollmentId: z.string().uuid("Inscription invalide."),
  discountAmount: z.coerce
    .number({
      required_error: "Le montant de remise est requis.",
      invalid_type_error: "Le montant de remise doit être un nombre.",
    })
    .int("Le montant de remise doit être un entier (sans décimale).")
    .positive("Le montant de remise doit être supérieur à 0."),
  // Vide OU absent → libellé par défaut (comportement de l'action historique
  // `|| "Remise manuelle"`), sinon texte trimé et borné à 180 caractères.
  discountLabel: z.preprocess(
    (value) => {
      const trimmed = typeof value === "string" ? value.trim() : ""
      return trimmed === "" ? "Remise manuelle" : trimmed
    },
    z.string().max(180, "Le libellé de remise est trop long (180 caractères max).")
  ),
})

export type ManualDiscountInput = z.infer<typeof manualDiscountSchema>
