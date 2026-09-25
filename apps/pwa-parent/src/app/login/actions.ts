"use server"

import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { normalizePhone, parentSyntheticEmail } from "@/lib/phone"

/**
 * Authentification parent par téléphone — architecture validée :
 * - le TÉLÉPHONE identifie le parent (clé `guardians.phone_norm`, déjà
 *   alimentée par le trigger SQL) ;
 * - le MOT DE PASSE protège le compte (jamais créé par l'école) ;
 * - le numéro est un droit d'ÉLIGIBILITÉ au premier accès (il doit figurer
 *   sur une inscription), jamais un droit d'accès à vie : les données
 *   affichées sont déduites des liens parent → élève → inscription.
 */

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type PhoneAuthCode =
  | "INVALID_INPUT"
  | "NO_PARENT"
  | "NO_ACCOUNT"
  | "ALREADY_CLAIMED"
  | "AUTH_FAILED"
  | "DB_ERROR"

export type PhoneAuthResult =
  | { ok: true }
  | { ok: false; code: PhoneAuthCode; message: string }

async function findGuardiansByPhone(phoneNorm: string) {
  const { data, error } = await adminClient()
    .from("guardians")
    .select("id, user_id, full_name")
    .eq("phone_norm", phoneNorm)
    .is("deleted_at", null)

  if (error) return null
  return (data ?? []) as unknown as Array<{ id: string; user_id: string | null; full_name: string }>
}

/**
 * Connexion : téléphone + mot de passe. Le numéro renvoie vers le compte
 * auth lié via guardians.user_id (multi-établissements : toutes les fiches
 * du même numéro partagent le même compte).
 */
export async function parentPhoneSignIn(
  phone: string,
  password: string
): Promise<PhoneAuthResult> {
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm || !password) {
    return { ok: false, code: "INVALID_INPUT", message: "Téléphone et mot de passe requis." }
  }

  const guardians = await findGuardiansByPhone(phoneNorm)
  if (guardians === null) {
    return { ok: false, code: "DB_ERROR", message: "Erreur serveur — réessayez." }
  }
  if (guardians.length === 0) {
    return {
      ok: false,
      code: "NO_PARENT",
      message: "Numéro inconnu de Schooly. Vérifiez la saisie ou créez votre compte.",
    }
  }

  const linked = guardians.find((g) => g.user_id)
  if (!linked?.user_id) {
    return {
      ok: false,
      code: "NO_ACCOUNT",
      message: "Aucun compte n'a encore été créé pour ce numéro — utilisez « Créer mon compte ».",
    }
  }

  const { data: target, error: targetErr } = await adminClient().auth.admin.getUserById(
    linked.user_id
  )
  if (targetErr || !target?.user?.email) {
    return { ok: false, code: "DB_ERROR", message: "Compte introuvable — contactez l'école." }
  }

  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: target.user.email,
    password,
  })
  if (signInErr) {
    return { ok: false, code: "AUTH_FAILED", message: "Téléphone ou mot de passe incorrect." }
  }

  return { ok: true }
}

/**
 * Premier accès : le numéro figure sur une inscription (schooly) → le parent
 * choisit son mot de passe, le compte auth est créé puis lié à TOUTES les
 * fiches guardians partageant ce numéro (multi-établissements) et le parent
 * est connecté.
 */
export async function claimParentAccount(
  phone: string,
  password: string,
  fullName: string
): Promise<PhoneAuthResult> {
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) {
    return { ok: false, code: "INVALID_INPUT", message: "Téléphone invalide." }
  }
  if (!password || password.length < 8) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Le mot de passe doit contenir au moins 8 caractères.",
    }
  }

  const guardians = await findGuardiansByPhone(phoneNorm)
  if (guardians === null) {
    return { ok: false, code: "DB_ERROR", message: "Erreur serveur — réessayez." }
  }
  if (guardians.length === 0) {
    return {
      ok: false,
      code: "NO_PARENT",
      message:
        "Ce numéro n'est pas connu d'un établissement Schooly. Il doit figurer sur une inscription.",
    }
  }
  if (guardians.some((g) => g.user_id)) {
    return {
      ok: false,
      code: "ALREADY_CLAIMED",
      message: "Un compte existe déjà pour ce numéro — connectez-vous.",
    }
  }

  // Éligibilité : le numéro doit être porteur d'au moins une inscription.
  const { count } = await adminClient()
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("guardian_id", guardians.map((g) => g.id))
    .is("deleted_at", null)
  if (!count) {
    return {
      ok: false,
      code: "NO_PARENT",
      message: "Aucune inscription ne porte ce numéro — l'accès en ligne nécessite une inscription.",
    }
  }

  const principal = guardians[0]
  const email = parentSyntheticEmail(phoneNorm)
  const { data: created, error: createErr } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName?.trim() || principal.full_name,
      role: "parent",
    },
  })
  if (createErr || !created?.user) {
    const already = String(createErr?.message ?? "").toLowerCase().includes("already")
    return {
      ok: false,
      code: already ? "ALREADY_CLAIMED" : "DB_ERROR",
      message: already
        ? "Un compte existe déjà pour ce numéro — connectez-vous."
        : "Création du compte impossible — réessayez.",
    }
  }

  // Le même compte couvre toutes les fiches du numéro (toutes les écoles).
  await adminClient()
    .from("guardians")
    .update({ user_id: created.user.id })
    .in("id", guardians.map((g) => g.id))

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect("/dashboard")
}
