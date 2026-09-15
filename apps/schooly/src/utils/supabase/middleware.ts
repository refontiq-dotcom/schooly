import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

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

  // Routes publiques accessibles sans authentification
  const publicPaths = ['/login', '/register-school', '/enroll', '/verify']
  const isPublicPath = publicPaths.some(
    (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`)
  )

  // Protection stricte : redirection vers /login si non connecté
  if (
    !user &&
    !isPublicPath &&
    !path.startsWith('/api') &&
    !path.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Routage basé sur le rôle lu directement en base (sans dépendre du hook JWT)
  // Cela fonctionne sur tous les plans Supabase (Free inclus)
  if (user && (path === '/' || path.startsWith('/login'))) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: roleData } = await adminClient
      .from("user_school_roles")
      .select("role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)

    const role = roleData?.[0]?.role_code || 'none'
    
    const url = request.nextUrl.clone()
    
    switch (role) {
      case 'super_admin':
        url.pathname = '/dashboard/super-admin'
        break
      case 'direction':
        url.pathname = '/dashboard/direction'
        break
      case 'caisse':
        url.pathname = '/dashboard/caisse'
        break
      case 'professeur':
        url.pathname = '/dashboard/pedagogie'
        break
      default:
        url.pathname = '/login'
    }

    if (url.pathname !== path) {
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
