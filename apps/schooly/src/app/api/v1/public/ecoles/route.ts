import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Middleware simple pour vérifier le Bearer token
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

  // On récupère toutes les écoles publiées
  const { data: schools, error } = await supabase
    .from("schools")
    .select(`
      id,
      name,
      city,
      address,
      latitude,
      longitude,
      phone,
      email,
      website_url,
      cover_image_url
    `)
    .eq("published_to_trouvetou", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Formatage au standard Refontiq §3
  const results = schools.map(school => ({
    id: school.id,
    categorie: "ecoles",
    nom: school.name,
    localisation: {
      lat: school.latitude || 0,
      lng: school.longitude || 0,
    },
    disponibilite: true, // À raffiner avec les places réelles
    prix_min: 0, // À raffiner avec fee_schedules
    prix_max: 0,
    medias: school.cover_image_url ? [school.cover_image_url] : [],
    badge_verifie: true, // Standard §3
    attributs_specifiques: {
      photos_360: [], // Standard §3
      grille_tarifaire_publique: {}, // Standard §3
      contact: {
        city: school.city,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website_url,
      }
    }
  }))

  return NextResponse.json({ establishments: results })
}
