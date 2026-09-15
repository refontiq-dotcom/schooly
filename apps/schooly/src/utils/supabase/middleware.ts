import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { isEntryPath, isPublicPath, roleHome } from "./route-rules"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // ─── 1. Tunnels publics + chemins techniques ────────────────────────────────
  // /login, /register-school, /verify/*, /enroll/*, /api/*, /_next/* ne doivent
  // JAMAIS être redirigés vers /login : c'est ce qui cassait l'inscription
  // d'école et la pré-inscription (audit socle — finding C2).
  if (isPublicPath(path)) {
    // Un utilisateur déjà connecté qui revient sur un écran d'entrée (/ ou
    // /login) est renvoyé vers son tableau de bord.
    if (!user || !isEntryPath(path)) {
      return supabaseResponse
    }

    const destination = await resolveHomePath(user.id)

    // Rôle sans tableau de bord dans cette app (ex. `parent` → PWA dédiée) :
    // on laisse la page d'entrée s'afficher au lieu de boucler sur /login.
    if (!destination || destination === path) {
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = destination
    return NextResponse.redirect(url)
  }

  // ─── 2. Protection stricte : session obligatoire ────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

/**
 * Tableau de bord de l'utilisateur, résolu en base (et non via le hook JWT :
 * fonctionne sur tous les plans Supabase, Free inclus).
 *
 * `role_code` est trié par ancienneté d'attribution : un utilisateur porteur de
 * plusieurs rôles (ex. direction + caisse) obtient un routage *déterministe*.
 *
 * NB dette technique connue : ceci fait un appel HTTP supplémentaire par requête
 * sur les écrans d'entrée. À remplacer par la lecture des claims du JWT
 * (public.custom_access_token_hook, migration 20260908100000_auth_hooks.sql).
 */
async function resolveHomePath(userId: string): Promise<string | null> {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: roleData } = await adminClient
    .from("user_school_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)

  return roleHome(roleData?.[0]?.role_code)
}
