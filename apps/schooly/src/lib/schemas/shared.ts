// ============================================================================
// lib/schemas/shared.ts — Briques réutilisables des schémas zod.
//
// Les schémas valident le FormData brut (tout y est une string) : ces helpers
// encapsulent les conversions explicites — jamais de `parseInt(...) || 0`
// silencieux dans les actions. Chaque message est FR complet et lisible par
// un guichetier : il est renvoyé tel quel au client par parseForm.
// ============================================================================

import { z } from "zod"

/** Checkbox HTML : "on" (cochée) ou champ absent → false par défaut. */
export function checkbox(defaultValue: false): z.ZodEffects<z.ZodBoolean, boolean, unknown>
/** Checkbox "inversée" (ex. collectPayment du guichet : absent = true, "0" = false). */
export function checkbox(defaultValue: true): z.ZodEffects<z.ZodBoolean, boolean, unknown>
export function checkbox(defaultValue: boolean): z.ZodEffects<z.ZodBoolean, boolean, unknown> {
  return z.preprocess((v) => {
    if (v === "on" || v === "true" || v === "1") return true
    if (v === "0" || v === "false") return false
    return defaultValue
  }, z.boolean())
}

/** UUID optionnel : champ absent OU vide → null (pas d'erreur). */
export function optionalUuid(message: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid(message).nullish().transform((v) => v ?? null)
  )
}

/** Texte requis : trimé, non vide, borné. */
export function requiredText(label: string, maxLength = 180) {
  return z
    .string({ required_error: `${label} est requis.`, invalid_type_error: `${label} est requis.` })
    .trim()
    .min(1, `${label} est requis.`)
    .max(maxLength, `${label} est trop long (max ${maxLength} caractères).`)
}

/** Texte optionnel : trimé, borné, vide → null. */
export function optionalText(label: string, maxLength = 180) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string({ invalid_type_error: `${label} est invalide.` })
      .trim()
      .max(maxLength, `${label} est trop long (max ${maxLength} caractères).`)
      .nullish()
      .transform((v) => v ?? null)
  )
}

/** Entier FCFA strict : refuse les flottants, négatifs et typos graves. */
// Surcharge exigée : sans elle, l'union `ZodNumber | ZodOptional<ZodNumber>`
// du corps rend `z.infer` `number | undefined` même quand `required: true`
// (3 erreurs tsc historiques : createPayment, closeCashSession, moratoires).
export function fcfaInt(
  label: string,
  opts: { min: number; max: number; required: true }
): z.ZodNumber
export function fcfaInt(
  label: string,
  opts: { min: number; max: number; required: false }
): z.ZodOptional<z.ZodNumber>
export function fcfaInt(
  label: string,
  { min, max, required }: { min: number; max: number; required: boolean }
) {
  const base = z.coerce
    .number({
      invalid_type_error: `${label} doit être un nombre.`,
      required_error: `${label} est requis.`,
    })
    .int(`${label} doit être un nombre entier de FCFA (sans décimales).`)
    .min(min, `${label} doit être au minimum de ${min.toLocaleString("fr-FR")} FCFA.`)
    .max(max, `${label} est irréaliste (max ${max.toLocaleString("fr-FR")} FCFA).`)
  return required ? base : base.optional()
}

/**
 * Date ISO « yyyy-mm-dd » réelle (refuse 2026-02-31) et optionnellement pas
 * dans le futur.
 */
export function isoDate(label: string, { allowFuture }: { allowFuture: boolean }) {
  return z
    .string({ required_error: `${label} est requise.`, invalid_type_error: `${label} est requise.` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} doit être une date valide au format AAAA-MM-JJ.`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`)
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
    }, `${label} est invalide (jour ou mois inexistant).`)
    .refine(
      (v) => allowFuture || new Date(`${v}T00:00:00Z`).getTime() <= Date.now(),
      `${label} ne peut pas être dans le futur.`
    )
}

/** Téléphone exploitable : au moins 8 chiffres après nettoyage. */
export function phone(label: string) {
  return z
    .string({ required_error: `${label} est requis.`, invalid_type_error: `${label} est requis.` })
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 8, `${label} est invalide (au moins 8 chiffres).`)
}
