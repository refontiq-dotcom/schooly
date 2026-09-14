import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Fetch all users in auth.users (via admin API)
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  // Fetch all users in public.users
  const { data: publicUsers, error: publicError } = await supabase.from("users").select("*")

  // Fetch all roles
  const { data: roles, error: rolesError } = await supabase.from("user_school_roles").select("*")

  return NextResponse.json({
    authUsers: authUsers?.users?.map(u => ({ id: u.id, email: u.email })),
    authError,
    publicUsers,
    publicError,
    roles,
    rolesError
  })
}
