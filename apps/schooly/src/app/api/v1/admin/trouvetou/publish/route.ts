import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    // Verifier role
    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", [...TROUVETOU_ADMIN_ROLES])
      .maybeSingle()

    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const { published } = await request.json()

    const { error } = await admin
      .from("schools")
      .update({ published_to_trouvetou: !!published })
      .eq("id", role.school_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
