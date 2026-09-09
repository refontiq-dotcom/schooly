import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { NextResponse, type NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL("/login", request.url))
}

function createServerClient() {
  // Import inline pour éviter un import circulaire
  const { createServerClient: create } = require("@supabase/ssr")
  const { cookies } = require("next/headers")
  const cookieStore = cookies()
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c: any[]) => c.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options)),
      },
    }
  )
}
