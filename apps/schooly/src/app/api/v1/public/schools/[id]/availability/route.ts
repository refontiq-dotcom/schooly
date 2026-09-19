import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique, cover_photo_url, gallery_photos, public_address, public_phone, public_email, public_website_url, public_highlights, admission_notes")
    .eq("id", schoolId)
    .eq("published_to_trouvetou", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (!school) return NextResponse.json({ error: "Ecole non trouvee ou non publiee" }, { status: 404 })

  const { data: levels } = await supabase
    .from("grade_levels")
    .select("id, name, level, cycle")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level", { ascending: true })

  const niveauIds = (levels || []).map((l) => l.id)
  const { data: classRows } = niveauIds.length
    ? await supabase.from("classes").select("grade_level_id, capacity").eq("school_id", schoolId).is("deleted_at", null).in("grade_level_id", niveauIds)
    : { data: [] as any[] }

  const capacityByLevel: Record<string, number> = {}
  for (const row of classRows || []) capacityByLevel[row.grade_level_id] = (capacityByLevel[row.grade_level_id] || 0) + (row.capacity || 0)

  const { data: enrollments } = niveauIds.length
    ? await supabase.from("enrollments").select("grade_level_id").eq("school_id", schoolId).in("status", ["confirmed", "active"]).is("deleted_at", null).in("grade_level_id", niveauIds)
    : { data: [] as any[] }

  const counts: Record<string, number> = {}
  for (const e of enrollments || []) counts[e.grade_level_id] = (counts[e.grade_level_id] || 0) + 1

  const niveaux = (levels || []).map((l) => {
    const enrolled = counts[l.id] || 0
    const capacite = capacityByLevel[l.id] || 0
    const tarif = Array.isArray(school.grille_tarifaire_publique)
      ? school.grille_tarifaire_publique.find((t: any) => t.grade_level_id === l.id)
      : null
    return { id: l.id, label: l.name, capacite, inscrits: enrolled, places_disponibles: Math.max(0, capacite - enrolled), prix_min: tarif?.prix_min || null, prix_max: tarif?.prix_max || null }
  })

  return NextResponse.json({
    school: {
      id: school.id,
      nom: school.name,
      ville: school.city,
      latitude: school.latitude,
      longitude: school.longitude,
      description: school.description_publique,
      itineraire: school.itineraire,
      cover_photo: school.cover_photo_url,
      gallery: Array.isArray(school.gallery_photos) ? school.gallery_photos : [],
      photos_360: Array.isArray(school.photos_360) ? school.photos_360 : [],
      video_url: school.video_url,
      grille_tarifaire: school.grille_tarifaire_publique,
      contact: { address: school.public_address, phone: school.public_phone, email: school.public_email, website: school.public_website_url },
      highlights: Array.isArray(school.public_highlights) ? school.public_highlights : [],
      admission_notes: school.admission_notes,
    },
    niveaux,
  })
}
