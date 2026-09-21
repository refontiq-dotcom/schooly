import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TrouvetouAdminClient } from "./client"

export default async function TrouvetouAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: roleData } = await admin
    .from("user_school_roles")
    .select("role_code, school_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", ["direction", "secretariat"])
    .limit(1)
    .maybeSingle()

  if (!roleData?.school_id) redirect("/login")

  const schoolId = roleData.school_id

  const { data: school } = await admin
    .from("schools")
    .select("id, name, city, published_to_trouvetou, description_publique, latitude, longitude, itineraire, photos_360, video_url, grille_tarifaire_publique, cover_photo_url, gallery_photos, public_address, public_phone, public_email, public_website_url, public_highlights, admission_notes")
    .eq("id", schoolId)
    .single()

  const { data: reservations } = await admin
    .from("trouvetou_reservations")
    .select("id, student_full_name, parent_full_name, parent_phone, status, created_at, grade_level_id")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: ads } = await admin
    .from("trouvetou_ads")
    .select("id, title, message, image_url, target_url, contact_phone, cta_label, start_date, end_date, duration_days, daily_rate, total_amount, payment_status, is_active, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: levels } = await admin
    .from("grade_levels")
    .select("id, name, level, cycle")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level", { ascending: true })

  return (
    <TrouvetouAdminClient
      schoolId={schoolId}
      school={school}
      reservations={reservations || []}
      ads={ads || []}
      levels={levels || []}
      roleCode={roleData.role_code}
    />
  )
}
