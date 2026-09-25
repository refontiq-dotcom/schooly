// ============================================================================
// lib/schemas/finance.ts — Contrats d'entrée des Server Actions finance.
//
// Source unique des modes de paiement (ré-exportée par enrollment-utils) et
// des schémas des actions d'encaissement, de caisse et de relance. Les
// montants sont des entiers FCFA stricts : flottants, négatifs et valeurs
// vides sont refusés avec un message explicite (plus de `parseInt(...) || 0`).
// ============================================================================

import { z } from "zod"
import { PAYMENT_METHODS } from "@/lib/payment-methods"
import { checkbox, fcfaInt, optionalText, optionalUuid, requiredText } from "./shared"

/** Montants d'encaissement : bornes réalistes (typos graves bloquées). */
const PAYMENT_AMOUNT_MIN = 1
const PAYMENT_AMOUNT_MAX = 1_000_000_000

/** POST createPayment — encaissement guichet/caisse (RPC record_payment). */
export const paymentActionSchema = z.object({
  enrollmentId: z.string().uuid("Inscription invalide — rechargez la page."),
  amount: fcfaInt("Le montant encaissé", {
    min: PAYMENT_AMOUNT_MIN,
    max: PAYMENT_AMOUNT_MAX,
    required: true,
  }),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: "Mode de paiement inconnu." }),
  }),
  reference: optionalText("La référence", 180),
  allowOverpay: checkbox(false),
})

/** POST openCashSession — fond de caisse initial. */
export const cashSessionOpenSchema = z.object({
  openingAmount: fcfaInt("Le fond de caisse", {
    min: 0,
    max: 100_000_000,
    required: true,
  }),
})

/** POST closeCashSession — montant compté en fin de session. */
export const cashSessionCloseSchema = z.object({
  closingAmount: fcfaInt("Le montant compté", {
    min: 0,
    max: PAYMENT_AMOUNT_MAX,
    required: true,
  }),
})

/** POST sendPaymentReminder — relance manuelle (canal borné par le CHECK DB). */
export const paymentReminderSchema = z.object({
  enrollmentId: z.string().uuid("Inscription invalide — rechargez la page."),
  reminderType: requiredText("Le type de relance", 60),
  channel: z.enum(["push", "sms", "whatsapp", "email"], {
    errorMap: () => ({ message: "Canal d'envoi inconnu." }),
  }),
})

/** POST createFeeSchedule — grille tarifaire d'un niveau (écriture compta/direction). */
export const feeScheduleSchema = z.object({
  gradeLevelId: z.string().uuid("Niveau invalide — rechargez la page."),
  financialProfileId: optionalUuid("Profil financier invalide."),
  amount: fcfaInt("Le montant", { min: 1, max: PAYMENT_AMOUNT_MAX, required: true }),
  academicYearId: z.string().uuid("Année académique invalide — rechargez la page."),
  label: optionalText("L'intitulé", 180),
})
