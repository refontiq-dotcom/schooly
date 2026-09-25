// ============================================================================
// lib/schemas/parse-form.ts — Pont FormData → zod des Server Actions.
//
// Toute action reçoit un FormData ; ce parseur le convertit en objet typé via
// un schéma et renvoie UN message FR lisible (première issue), prêt à être
// retourné au client dans le contrat { error } existant. Aucun détail
// technique (chemin de champ, code zod) ne fuit vers l'UI.
// ============================================================================

import type { z } from "zod"

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  formData: FormData
): ParseResult<z.infer<TSchema>> {
  const raw: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    // Première valeur de chaque clé (les formulaires de l'app n'ont pas de
    // champs multiples) ; les File sont ignorés (aucun upload ici).
    if (typeof value === "string" && !(key in raw)) raw[key] = value
  }

  const parsed = schema.safeParse(raw)
  if (parsed.success) return { ok: true, data: parsed.data }

  const issue = parsed.error.issues[0]
  return { ok: false, error: issue?.message ?? "Données du formulaire invalides." }
}
