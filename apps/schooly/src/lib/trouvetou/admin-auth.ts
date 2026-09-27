/**
 * Garde d'accès des routes d'administration Trouvetou.
 *
 * Factorisé : la liste des rôles vit déjà dans `lib/supabase/roles` (source
 * unique depuis P2-2) et l'établissement est TOUJOURS déduit du rôle en base.
 * Le navigateur ne fournit jamais d'identifiant d'établissement : c'est ce qui
 * rend les autres garde-fous effectifs.
 */
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"

/**
 * Fabrique du client Supabase service (contourne le RLS).
 *
 * Le type est déduit de CET appel et non de `createAdminClient` :
 * `ReturnType<typeof createClient>` retomberait sur les paramètres génériques
 * par défaut de la bibliothèque et ferait perdre tout typage de colonne.
 */
export function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type AdminClient = ReturnType<typeof createAdmin>

export type AuthorizedContext = {
  admin: AdminClient
  schoolId: string
}

/**
 * Résout l'établissement de l'appelant à partir de son rôle en base.
 *
 * Renvoie une `NextResponse` d'erreur si l'appelant n'est pas autorisé : les
 * appelers testent avec `instanceof NextResponse` et la renvoient telle quelle.
 */
export async function requireTrouvetouAdmin(): Promise<AuthorizedContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const admin = createAdmin()
  const { data: role } = await admin
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", [...TROUVETOU_ADMIN_ROLES])
    .maybeSingle()

  if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })
  return { admin, schoolId: role.school_id }
}