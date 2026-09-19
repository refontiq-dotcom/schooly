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
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", [...TROUVETOU_ADMIN_ROLES])
      .maybeSingle()

    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const body = await request.json()
    const cleanArray = (value: unknown) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : []

    const { error } = await admin
      .from("schools")
      .update({
        description_publique: String(body.description_publique || "").trim() || null,
        latitude: Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
        longitude: Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null,
        itineraire: String(body.itineraire || "").trim() || null,
        video_url: String(body.video_url || "").trim() || null,
        photos_360: cleanArray(body.photos_360),
        cover_photo_url: String(body.cover_photo_url || "").trim() || null,
        gallery_photos: cleanArray(body.gallery_photos),
        public_address: String(body.public_address || "").trim() || null,
        public_phone: String(body.public_phone || "").trim() || null,
        public_email: String(body.public_email || "").trim() || null,
        public_website_url: String(body.public_website_url || "").trim() || null,
        public_highlights: cleanArray(body.public_highlights),
        admission_notes: String(body.admission_notes || "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", role.school_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
