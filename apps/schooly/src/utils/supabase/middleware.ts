import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  isEntryPath,
  isPublicPath,
  isStudentPortalPath,
  legacyRedirectFor,
  roleHome,
  isRoleAllowedPath,
  isBillingAccessPath,
} from "./route-rules"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

  const legacy = legacyRedirectFor(path)
  if (legacy) {
    const url = request.nextUrl.clone()
    url.pathname = legacy
    return NextResponse.redirect(url, 308)
  }

  if (isStudentPortalPath(path)) {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isPublicPath(path)) {
    if (!user) {
      return supabaseResponse
    }

    const billingStatus = await resolveBillingStatus(user.id)
    if (billingStatus && (billingStatus === "restricted" || billingStatus === "suspended") && !isBillingAccessPath(path)) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "SCHOOL_BILLING_RESTRICTED", status: billingStatus }, { status: 402 })
      }
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard/billing"
      url.searchParams.set("access", billingStatus)
      return NextResponse.redirect(url)
    }

    if (!isEntryPath(path)) {
      return supabaseResponse
    }

    const destination = await resolveHomePath(supabase, user.id)

    if (!destination || destination === path) {
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = destination
    return NextResponse.redirect(url)
  }

  const billingStatus = await resolveBillingStatus(user.id)
  if (billingStatus && (billingStatus === "restricted" || billingStatus === "suspended") && !isBillingAccessPath(path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "SCHOOL_BILLING_RESTRICTED", status: billingStatus }, { status: 402 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard/billing"
    url.searchParams.set("access", billingStatus)
    return NextResponse.redirect(url)
  }

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
  return resolveRoleCodeFromDatabase(userId)
}

async function resolveHomePath(
  supabase: ClaimsClient,
  userId: string
): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claimRole = session?.user?.app_metadata?.role
  if (claimRole) return roleHome(claimRole)

  const role = await resolveRoleCodeFromDatabase(userId)
  return roleHome(role ?? undefined)
}

async function resolveBillingStatus(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null

  const { createClient } = await import("@supabase/supabase-js")
  const client = createClient(url, key)
  const { data: roles } = await client
    .from("user_school_roles")
    .select("school_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
  const schoolId = roles?.[0]?.school_id
  if (!schoolId) return null

  const { data } = await client
    .from("school_billing_access")
    .select("status")
    .eq("school_id", schoolId)
    .maybeSingle()
  return data?.status ?? null
}

async function resolveRoleCodeFromDatabase(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null

  const { createClient } = await import("@supabase/supabase-js")
  const client = createClient(url, key)
  const { data } = await client
    .from("user_school_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)

  return data?.[0]?.role_code ?? null
}

type ClaimsClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { user: { app_metadata?: Record<string, string> } } | null }
    }>
  }
}
