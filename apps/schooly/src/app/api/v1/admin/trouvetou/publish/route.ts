import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"

type SyncLevel = {
  id: string
  label: string
  capacity: number
  prix_min: number | null
  prix_max: number | null
  places_disponibles: number
}

function getTrouvetouConfig() {
  const baseUrl = (process.env.TROUVETOU_SYNC_URL || "https://trouvetou.vercel.app").replace(/\/$/, "")
  const apiKey = process.env.TROUVETOU_API_KEY
  if (!apiKey) throw new Error("Configuration Trouvetou manquante : TROUVETOU_API_KEY")
  return {
    endpoint: baseUrl.endsWith("/api/v1/sync/schooly") ? baseUrl : baseUrl + "/api/v1/sync/schooly",
    apiKey,
  }
}

async function syncSchoolToTrouvetou(admin: SupabaseClient, schoolId: string, published: boolean) {
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name, city, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique, cover_photo_url, gallery_photos, public_address, public_phone, public_email, public_website_url, public_highlights, admission_notes")
    .eq("id", schoolId)
    .is("deleted_at", null)
    .single()
  if (schoolError || !school) throw new Error(schoolError?.message || "Établissement introuvable")

  const { data: levels, error: levelsError } = await admin
    .from("grade_levels")
    .select("id, name")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("level", { ascending: true })
  if (levelsError) throw new Error(levelsError.message)

  const niveaux: SyncLevel[] = (levels || []).map((level) => ({
    id: level.id,
    label: level.name,
    capacity: 0,
    prix_min: null,
    prix_max: null,
    places_disponibles: 0,
  }))

  const schoolPayload = {
    id: school.id,
    schooly_instance_url: process.env.TROUVETOU_INSTANCE_URL || "https://admin.schooly.ci",
    nom: school.name,
    ville: school.city,
    latitude: school.latitude,
    longitude: school.longitude,
    description_publique: school.description_publique,
    itineraire: school.itineraire,
    cover_photo: school.cover_photo_url,
    gallery: Array.isArray(school.gallery_photos) ? school.gallery_photos : [],
    photos_360: Array.isArray(school.photos_360) ? school.photos_360 : [],
    video_url: school.video_url,
    grille_tarifaire_publique: school.grille_tarifaire_publique || [],
    contact: {
      address: school.public_address,
      phone: school.public_phone,
      email: school.public_email,
      website: school.public_website_url,
    },
    highlights: Array.isArray(school.public_highlights) ? school.public_highlights : [],
    admission_notes: school.admission_notes,
    published,
  }

  const { endpoint, apiKey } = getTrouvetouConfig()
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trouvetou-api-key": apiKey },
    body: JSON.stringify({ school: schoolPayload, levels: niveaux }),
    cache: "no-store",
  })
  const body = await response.json().catch(() => ({}))
  // IMPORTANT : `body.ok === true` ne suffit pas à prouver qu'une fiche
  // catalogue existe côté Trouvetou. L'ancienne version de /api/v1/sync/schooly
  // renvoyait déjà `ok: true` après le seul RPC `schooly_sync_school`, avant
  // même que le code de création de la fiche `listings` (+ listing_id) existe.
  // On exige donc explicitement un `listing_id` non vide pour considérer la
  // synchronisation comme confirmée — sinon le flag `published_to_trouvetou`
  // peut rester "true" en base Schooly alors qu'aucune fiche n'est publiée
  // dans le catalogue public Trouvetou (cas constaté sur ITES).
  if (!response.ok || body?.ok !== true) {
    throw new Error(body?.error || ("Trouvetou a refusé la synchronisation (" + response.status + ")"))
  }
  const listingId = typeof body?.listing_id === "string" && body.listing_id ? body.listing_id : null
  if (published && !listingId) {
    throw new Error("Trouvetou a répondu sans confirmer la création de la fiche catalogue (listing_id manquant).")
  }
  return { levels: niveaux.length, result: body?.result ?? null, listingId }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin: SupabaseClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: role } = await admin
      .from("user_school_roles")
      .select("school_id, role_code")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role_code", [...TROUVETOU_ADMIN_ROLES])
      .maybeSingle()
    if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })

    const { published } = await request.json()
    const nextPublished = !!published

    if (nextPublished) {
      const { data: publicationSchool, error: publicationSchoolError } = await admin
        .from("schools")
        .select("cover_photo_url, gallery_photos, photos_360")
        .eq("id", role.school_id)
        .is("deleted_at", null)
        .single()

      if (publicationSchoolError || !publicationSchool) {
        return NextResponse.json(
          { error: "Impossible de vérifier les photos de l'établissement." },
          { status: 500 }
        )
      }

      const hasPhoto = Boolean(
        typeof publicationSchool.cover_photo_url === "string" &&
          publicationSchool.cover_photo_url.trim()
      ) ||
        (Array.isArray(publicationSchool.gallery_photos) &&
          publicationSchool.gallery_photos.some(
            (photo) => typeof photo === "string" && photo.trim()
          )) ||
        (Array.isArray(publicationSchool.photos_360) &&
          publicationSchool.photos_360.some(
            (photo) => typeof photo === "string" && photo.trim()
          ))

      if (!hasPhoto) {
        return NextResponse.json(
          {
            error: "Publication impossible : ajoutez au moins une photo ou renseignez le lien d'une photo avant de publier la fiche Trouvetou.",
            code: "PHOTO_REQUIRED",
          },
          { status: 400 }
        )
      }
    }

    const { error: updateError } = await admin
      .from("schools")
      .update({ published_to_trouvetou: nextPublished })
      .eq("id", role.school_id)
    if (updateError) throw updateError

    try {
      const sync = await syncSchoolToTrouvetou(admin, role.school_id, nextPublished)

      // On ne considère la synchronisation confirmée (et on ne trace
      // trouvetou_listing_id / trouvetou_synced_at) que si Trouvetou a
      // effectivement renvoyé un listing_id pour une publication. Pour une
      // dépublication (nextPublished = false), il n'y a pas de nouvelle
      // fiche à confirmer : on efface simplement le suivi de confirmation.
      await admin
        .from("schools")
        .update(
          nextPublished
            ? { trouvetou_listing_id: sync.listingId, trouvetou_synced_at: new Date().toISOString() }
            : { trouvetou_listing_id: null, trouvetou_synced_at: null }
        )
        .eq("id", role.school_id)

      return NextResponse.json({
        success: true,
        published: nextPublished,
        trouvetou: { synced: true, listingId: sync.listingId, levels: sync.levels, result: sync.result },
      })
    } catch (syncError) {
      // Rollback complet : le flag ET le suivi de confirmation reviennent à
      // l'état précédent. On ne laisse jamais published_to_trouvetou = true
      // sans qu'une synchronisation confirmée (listing_id) l'accompagne.
      await admin
        .from("schools")
        .update({ published_to_trouvetou: !nextPublished, trouvetou_listing_id: null, trouvetou_synced_at: null })
        .eq("id", role.school_id)
      return NextResponse.json(
        {
          error: "La publication Trouvetou a échoué. L'établissement a été remis dans son état précédent.",
          details: syncError instanceof Error ? syncError.message : "Erreur de synchronisation",
        },
        { status: 502 }
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur" }, { status: 500 })
  }
}
