import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeHttpUrl, normalizeHttpUrlList } from "@/lib/safe-url"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return token === process.env.TROUVETOU_API_KEY_PEPPER || token === process.env.TROUVETOU_API_KEY
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: schools, error } = await supabase
    .from("schools")
    .select(`
      id, name, city, latitude, longitude, description_publique, itineraire,
      photos_360, video_url, grille_tarifaire_publique, cover_photo_url,
      gallery_photos, public_address, public_phone, public_email,
      public_website_url, public_highlights, admission_notes
    `)
    .eq("published_to_trouvetou", true)
    .is("deleted_at", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = (schools || []).map(school => {
    const coverPhoto = normalizeHttpUrl(school.cover_photo_url)
    const gallery = normalizeHttpUrlList(school.gallery_photos)
    const photos360 = normalizeHttpUrlList(school.photos_360)
    const videoUrl = normalizeHttpUrl(school.video_url)
    const website = normalizeHttpUrl(school.public_website_url)

    return {
      id: school.id,
      categorie: "ecoles",
      nom: school.name,
      localisation: { lat: school.latitude || 0, lng: school.longitude || 0 },
      disponibilite: true,
      prix_min: 0,
      prix_max: 0,
      medias: [coverPhoto, ...gallery].filter((url): url is string => url !== null),
      badge_verifie: true,
      attributs_specifiques: {
        description: school.description_publique,
        itineraire: school.itineraire,
        photos_360: photos360,
        video_url: videoUrl,
        grille_tarifaire_publique: school.grille_tarifaire_publique || {},
        highlights: school.public_highlights || [],
        admission_notes: school.admission_notes,
        contact: {
          city: school.city,
          address: school.public_address,
          phone: school.public_phone,
          email: school.public_email,
          website,
        }
      }
    }
  })

  return NextResponse.json({ establishments: results })
}
