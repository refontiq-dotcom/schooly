"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

/**
 * Portail élève — accès par code QR (Phase 7 : student_qr_codes).
 * La table students n'a pas de lien vers les comptes auth : l'élève déverrouille
 * son espace avec le code QR remis par l'école. La session est mémorisée dans un
 * cookie httpOnly (8 h) et peut être révoquée à tout moment par la surveillance
 * (désactivation du QR) — chaque lecture revérifie l'état du code.
 */

const COOKIE_NAME = "schooly_student_enrollment"
const MAX_AGE = 60 * 60 * 8 // 8 heures

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type UnlockState = { error?: string }

export async function unlockStudentPortal(
  _prev: UnlockState,
  formData: FormData
): Promise<UnlockState> {
  const code = String(formData.get("code") ?? "").trim()
  if (!code) return { error: "Veuillez saisir votre code d'accès." }

  const db = admin()

  const { data: qrRows, error } = await db
    .from("student_qr_codes")
    .select(
      `id, enrollment_id, is_active,
       enrollments (
         id, deleted_at,
         students ( first_name, last_name ),
         classes ( name )
       )`
    )
    .eq("qr_code", code)
    .limit(1)

  if (error) return { error: "Erreur technique. Réessayez." }

  const qr = (qrRows ?? [])[0] as unknown as
    | {
        id: string
        enrollment_id: string
        is_active: boolean
        enrollments: {
          id: string
          deleted_at: string | null
          students: { first_name: string; last_name: string } | null
          classes: { name: string } | null
        } | null
      }
    | undefined

  if (!qr || !qr.is_active || !qr.enrollments || qr.enrollments.deleted_at) {
    return { error: "Code invalide ou désactivé. Contactez la vie scolaire." }
  }

  const store = await cookies()
  store.set(COOKIE_NAME, qr.enrollments.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  })

  redirect("/dashboard/eleve")
}

export async function lockStudentPortal(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
  redirect("/dashboard/eleve")
}

export async function getStudentEnrollmentId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}
