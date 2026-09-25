// ============================================================================
// lib/schemas/admissions.ts — Contrats d'entrée des Server Actions admissions.
//
// Les règles métier historiques (champs requis, paire école précédente /
// dernière classe, encaissement conditionnel) sont reprises à l'identique et
// exprimées une seule fois ici — plus de 7 `if` dispersés dans chaque action.
// ============================================================================

import { z } from "zod"
import { PAYMENT_METHODS } from "@/lib/payment-methods"
import { checkbox, fcfaInt, isoDate, optionalText, optionalUuid, phone, requiredText } from "./shared"

const STUDENT_NAME_MAX = 80

/** POST createPreEnrollment — tunnel PUBLIC /enroll/[schoolId]. */
export const preEnrollmentPublicSchema = z
  .object({
    schoolId: z.string().uuid("Établissement invalide."),
    firstName: requiredText("Le prénom de l'élève", STUDENT_NAME_MAX),
    lastName: requiredText("Le nom de l'élève", STUDENT_NAME_MAX),
    dateOfBirth: isoDate("La date de naissance", { allowFuture: false }),
    gradeLevelId: z.string().uuid("Niveau scolaire invalide."),
    guardianPhone: phone("Le téléphone du tuteur"),
    guardianName: optionalText("Le nom du tuteur", STUDENT_NAME_MAX),
    birthCertificateNumber: optionalText("Le numéro d'acte de naissance", 80),
    guardianRelation: requiredText("Le lien avec l'élève", 60),
    emergencyContactName: requiredText("Le contact d'urgence", STUDENT_NAME_MAX),
    emergencyContactPhone: phone("Le téléphone du contact d'urgence"),
    previousSchool: optionalText("L'école précédente", 120),
    previousClass: optionalText("La dernière classe fréquentée", 60),
    enrollmentType: requiredText("Le type d'inscription", 40),
    stateOrientation: requiredText("L'orientation", 60),
    orientationNumber: optionalText("Le numéro d'orientation", 60),
    previousMatricule: optionalText("Le matricule précédent", 40),
    paymentMethodId: optionalUuid("Mode de paiement invalide."),
    paymentReference: optionalText("La référence de paiement", 180),
  })
  .superRefine((val, ctx) => {
    // Règle historique : l'école précédente et la dernière classe vont ensemble.
    if (Boolean(val.previousSchool) !== Boolean(val.previousClass)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'école précédente et la dernière classe fréquentée vont ensemble.",
        path: ["previousSchool"],
      })
    }
  })

/** POST validatePreEnrollment — validation au guichet (+ encaissement optionnel). */
export const preEnrollmentValidateSchema = z
  .object({
    preEnrollmentId: z.string().uuid("Pré-inscription invalide."),
    classId: optionalUuid("Classe invalide."),
    collectPayment: checkbox(false),
    amount: fcfaInt("Le montant encaissé", { min: 1, max: 1_000_000_000, required: false }),
    paymentMethod: z
      .enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Mode de paiement inconnu." }) })
      .optional(),
    paymentReference: optionalText("La référence de paiement", 180),
  })
  .superRefine((val, ctx) => {
    if (!val.collectPayment) return
    if (val.amount === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le montant encaissé est requis.", path: ["amount"] })
    }
    if (!val.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le mode de paiement est requis.", path: ["paymentMethod"] })
    }
  })

/** POST completeCounterEnrollment — inscription directe au guichet. */
export const counterEnrollmentSchema = z
  .object({
    firstName: requiredText("Le prénom de l'élève", STUDENT_NAME_MAX),
    lastName: requiredText("Le nom de l'élève", STUDENT_NAME_MAX),
    dateOfBirth: isoDate("La date de naissance", { allowFuture: false }),
    gradeLevelId: z.string().uuid("Niveau scolaire invalide."),
    classId: optionalUuid("Classe invalide."),
    guardianPhone: phone("Le téléphone du tuteur"),
    guardianName: requiredText("Le nom du tuteur", STUDENT_NAME_MAX),
    birthCertificateNumber: optionalText("Le numéro d'acte de naissance", 80),
    collectPayment: checkbox(true), // historique : absent = encaisser
    amount: fcfaInt("Le montant encaissé", { min: 1, max: 1_000_000_000, required: false }),
    paymentMethod: z
      .enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Mode de paiement inconnu." }) })
      .optional(),
    paymentReference: optionalText("La référence de paiement", 180),
  })
  .superRefine((val, ctx) => {
    if (!val.collectPayment) return
    if (val.amount === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le montant encaissé est requis.", path: ["amount"] })
    }
    if (!val.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le mode de paiement est requis.", path: ["paymentMethod"] })
    }
  })
