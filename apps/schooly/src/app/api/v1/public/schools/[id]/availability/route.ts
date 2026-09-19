import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await params
  const { data: school } = await supabase.from("schools").select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique, cover_photo_url, gallery_photos, public_address, public_phone, public_email, public_website_url, public_highlights, admission_notes").eq("id", schoolId).eq("published_to_trouvetou", true).is("deleted_at", null).maybeSingle()
  if (!school) return NextResponse.json({ error: "Ecole non trouvee ou non publiee" }, { status: 404 })

  const { data: levels } = await supabase.from("grade_levels").select("id, name, level, cycle").eq("school_id", schoolId).is("deleted_at", null).order("level", { ascending: true })
  const ids = (levels || []).map(l => l.id)
  const { data: classRows } = ids.length ? await supabase.from("classes").select("grade_level_id, capacity").eq("school_id", schoolId).is("deleted_at", null).in("grade_level_id", ids) : { data: [] as any[] }
  const capacity: Record<string, number> = {}
  for (const row of classRows || []) capacity[row.grade_level_id] = (capacity[row.grade_level_id] || 0) + (row.capacity || 0)

  const { data: enrollments } = ids.length ? await supabase.from("enrollments").select("grade_level_id").eq("school_id", schoolId).in("status", ["confirmed", "active"]).is("deleted_at", null).in("grade_level_id", ids) : { data: [] as any[] }
  const { data: reservations } = ids.length ? await supabase.from("trouvetou_reservations").select("grade_level_id").eq("school_id", schoolId).eq("status", "reserved").gt("expires_at", new Date().toISOString()).in("grade_level_id", ids) : { data: [] as any[] }
  const occupied: Record<string, number> = {}
  for (const row of enrollments || []) occupied[row.grade_level_id] = (occupied[row.grade_level_id] || 0) + 1
  for (const row of reservations || []) occupied[row.grade_level_id] = (occupied[row.grade_level_id] || 0) + 1

  const niveaux = (levels || []).map(l => {
    const cap = capacity[l.id] || 0
    const used = occupied[l.id] || 0
    const tarif = Array.isArray(school.grille_tarifaire_publique) ? school.grille_tarifaire_publique.find((t: any) => t.grade_level_id === l.id) : null
    return { id: l.id, label: l.name, cycle: l.cycle, capacite: cap, inscrits: used, places_disponibles: Math.max(0, cap - used), disponible: cap > 0 ? used < cap : null, prix_min: tarif?.prix_min || null, prix_max: tarif?.prix_max || null }
  })

  return NextResponse.json({
    school: {
      id: school.id, nom: school.name, ville: school.city, latitude: school.latitude, longitude: school.longitude,
      description: school.description_publique, itineraire: school.itineraire, cover_photo: school.cover_photo_url,
      gallery: Array.isArray(school.gallery_photos) ? school.gallery_photos : [],
      photos_360: Array.isArray(school.photos_360) ? school.photos_360 : [],
      video_url: school.video_url, grille_tarifaire: school.grille_tarifaire_publique,
      contact: { address: school.public_address, phone: school.public_phone, email: school.public_email, website: school.public_website_url },
      highlights: Array.isArray(school.public_highlights) ? school.public_highlights : [], admission_notes: school.admission_notes
    },
    niveaux,
    flow: ["recherche", "disponibilite", "demande", "qualification", "paiement", "inscription"]
  })
}