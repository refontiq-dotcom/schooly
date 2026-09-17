import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/v1/public/schools/[id]/availability
 *
 * Expose les places disponibles par niveau pour Trouvetou.
 * Contrat Trouvetou Connector — lecture seule.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params

  // Verifier que l ecole est publiee
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique")
    .eq("id", schoolId)
    .eq("published_to_trouvetou", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: "Ecole non trouvee ou non publiee" }, { status: 404 })
  }

  // Capacite = somme des classes du niveau (grade_levels n'a pas de colonne capacity).
  const { data: levels } = await supabase
    .from("grade_levels")
    .select("id, name, level, cycle")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level", { ascending: true })

  if (!levels || levels.length === 0) {
    return NextResponse.json({
      school: {
        id: school.id,
        nom: school.name,
        ville: school.city,
        latitude: school.latitude,
        longitude: school.longitude,
        description: school.description_publique,
        itineraire: school.itineraire,
        photos_360: school.photos_360,
        video_url: school.video_url,
        grille_tarifaire: school.grille_tarifaire_publique,
      },
      niveaux: [],
    })
  }

  const niveauIds = levels.map((l) => l.id)
  const { data: classRows } = await supabase
    .from("classes")
    .select("grade_level_id, capacity")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .in("grade_level_id", niveauIds)

  const capacityByLevel: Record<string, number> = {}
  for (const row of classRows || []) {
    capacityByLevel[row.grade_level_id] =
      (capacityByLevel[row.grade_level_id] || 0) + (row.capacity || 0)
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("grade_level_id")
    .eq("school_id", schoolId)
    .in("status", ["confirmed", "active"])
    .is("deleted_at", null)
    .in("grade_level_id", niveauIds)

  const counts: Record<string, number> = {}
  for (const e of enrollments || []) {
    counts[e.grade_level_id] = (counts[e.grade_level_id] || 0) + 1
  }

  const niveaux = levels.map((l) => {
    const enrolled = counts[l.id] || 0
    const capacite = capacityByLevel[l.id] || 0
    const tarif = Array.isArray(school.grille_tarifaire_publique)
      ? school.grille_tarifaire_publique.find((t: any) => t.grade_level_id === l.id)
      : null
    return {
      id: l.id,
      label: l.name,
      capacite,
      inscrits: enrolled,
      places_disponibles: Math.max(0, capacite - enrolled),
      prix_min: tarif?.prix_min || null,
      prix_max: tarif?.prix_max || null,
    }
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
      photos_360: school.photos_360,
      video_url: school.video_url,
      grille_tarifaire: school.grille_tarifaire_publique,
    },
    niveaux,
  })
}
