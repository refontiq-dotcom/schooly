import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import {
  isEntryPath,
  isPublicPath,
  isStudentPortalPath,
  legacyRedirectFor,
  roleHome,
  isRoleAllowedPath,
} from "./route-rules"

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

  const path = request.nextUrl.pathname

  // ─── 0. URLs legacy (audit P1-1) ────────────────────────────────────────────
  // Ancienne URL du portail élève (QR codes déjà imprimés, favoris) → /eleve.
  const legacy = legacyRedirectFor(path)
  if (legacy) {
    const url = request.nextUrl.clone()
    url.pathname = legacy
    return NextResponse.redirect(url, 308)
  }

  // ─── 0bis. Portail élève : pas de session Supabase staff ───────────────────
  // Auth par code QR (cookie httpOnly revérifié à chaque lecture) : ni exigence
  // de session, ni appel getUser() consommé pour ce chemin.
  if (isStudentPortalPath(path)) {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

    const destination = await resolveHomePath(supabase, user.id)

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

  const roleCode = await resolveRoleCode(supabase, user.id)
  if (path.startsWith("/dashboard") && roleCode && !isRoleAllowedPath(roleCode, path)) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome(roleCode) ?? "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

async function resolveRoleCode(
  supabase: ClaimsClient,
  userId: string
): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claimRole = session?.user?.app_metadata?.role
  if (claimRole) return claimRole

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await adminClient
    .from("user_school_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
  return data?.[0]?.role_code ?? null
}

/**
 * Tableau de bord de l'utilisateur.
 *
 * 1. **Claims du JWT** (audit P2-3) : le hook `custom_access_token_hook`
 *    injecte `app_metadata.role` à chaque émission/refresh du token — la
 *    lecture est locale (décodage des cookies), zéro appel SQL par requête.
 * 2. **Repli base** : si les claims sont absents (hook pas encore enregistré
 *    côté dashboard Supabase, ou token émis avant activation), on résout en
 *    base comme avant — rollout progressif, aucun retour arrière requis.
 *
 * Le repli trie par ancienneté d'attribution (`created_at` asc) : un
 * utilisateur porteur de plusieurs rôles (ex. direction + caisse) obtient un
 * routage *déterministe*. Le hook (migration 20260916000001) reprend ce tri.
 */
type ClaimsClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { user: { app_metadata?: Record<string, string> } } | null }
    }>
  }
}

async function resolveHomePath(
  supabase: ClaimsClient,
  userId: string
): Promise<string | null> {
  // 1. Claims JWT (P2-3) : `role` injecté par le hook dans app_metadata.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claimRole = session?.user?.app_metadata?.role
  if (claimRole) return roleHome(claimRole)

  // 2. Repli : résolution en base (service_role), comportement historique.
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
