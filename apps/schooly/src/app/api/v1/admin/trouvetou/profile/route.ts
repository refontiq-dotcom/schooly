import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", ["direction", "super_admin"])
      .maybeSingle()

    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const body = await request.json()

    const { error } = await admin
      .from("schools")
      .update({
        description_publique: body.description_publique || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        itineraire: body.itineraire || null,
        video_url: body.video_url || null,
        photos_360: body.photos_360 || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", role.school_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
