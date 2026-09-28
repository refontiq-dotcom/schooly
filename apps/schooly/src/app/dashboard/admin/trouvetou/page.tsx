import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TrouvetouAdminClient } from "./client"
import { normalizeAds, normalizePanorama, normalizeReservations, normalizeSchool } from "./_lib/types"

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
    .select("school_id")
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

  // Visites 360° de l'établissement. `room_id IS NULL` car une visite 360°
  // n'appartient pas à une salle : c'est la même condition que celle du publish
  // route, qui ne synchronise que celles-là.
  const { data: panoramaRows } = await admin
    .from("school_media")
    .select("id, status, public_url, width, height, byte_size, rejection_code, rejection_details, published_at")
    .eq("school_id", schoolId)
    .eq("kind", "panorama_360")
    .is("room_id", null)
    .order("created_at", { ascending: false })
    .limit(20)

  // La visite publiée est prioritaire sur la plus récente : sinon un dépôt
  // plus récent mais refusé masquerait le fait qu'un panorama est déjà en
  // ligne, et l'interface laisserait croire que la case est libre.
  const panoramas = (panoramaRows ?? []).map(normalizePanorama).filter((row) => row !== null)
  const panorama = panoramas.find((row) => row.status === "published") ?? panoramas[0] ?? null

  // Normalisation à la frontière serveur : le client reçoit déjà du typé,
  // sans cast `any`. (La requête grade_levels était morte : jamais lue.)
  return (
    <TrouvetouAdminClient
      school={normalizeSchool(school)}
      reservations={normalizeReservations(reservations)}
      ads={normalizeAds(ads)}
      panorama={panorama}
    />
  )
}
