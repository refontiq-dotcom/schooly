import { NextResponse } from "next/server"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"
import { toTrouvetouMediaContract, type TrouvetouMediaContract } from "@/lib/media/panorama-state"

type SyncLevel = {
  id: string
  label: string
  capacity: number
  prix_min: number | null
  prix_max: number | null
  places_disponibles: number
}

/** Seule valeur de `school_media.kind` qui décrit une visite 360°. */
const PANORAMA_KIND = "panorama_360"

/**
 * Visites 360° RÉELLEMENT publiées pour cet établissement.
 *
 * La sélection se fait en base (`status = published`, `kind = panorama_360`) et
 * non en mémoire : c'est la seule façon de garantir qu'un média `uploaded`,
 * `validated` ou `rejected` ne parte jamais vers Trouvetou. Le filtre en base
 * fait aussi office de garde-fou si un contrôle devait être contourné.
 *
 * Chaque ligne passe ensuite par `toTrouvetouMediaContract()`, qui refuse
 * elle-même tout média non `published` et construit le contrat du §12. Le
 * format n'est donc pas redéfini ici : il n'existe qu'à un seul endroit.
 *
 * `room_id` est recopié tel quel, sans être utilisé : il désigne un
 * `dorm_rooms` Schooly, non interopérable avec les identifiants Trouvetou.
 */
async function loadPublishedPanoramas(admin: SupabaseClient, schoolId: string) {
  const { data, error } = await admin
    .from("school_media")
    .select("id, status, r2_key, public_url, width, height, byte_size, content_type, room_id, validated_at")
    .eq("school_id", schoolId)
    .eq("kind", PANORAMA_KIND)
    .eq("status", "published")
    // Pas de filtre `deleted_at` : `school_media` n'a pas cette colonne — la
    // suppression y est physique (`delete` sur la ligne), et le fichier
    // R2 supprimé en amont. Le statut `published` est donc bien la seule
    // source de vérité.

  // Un échec de lecture ne doit pas publier l'établissement à moitié : mieux
  // vaut refuser la synchronisation que pousser une fiche sans ses panoramas,
  // ce qui effacerait chez Trouvetou des visites déjà visibles.
  if (error) throw error

  return (data ?? [])
    .map((media) =>
      toTrouvetouMediaContract({
        id: media.id,
        status: media.status,
        r2_key: media.r2_key,
        public_url: media.public_url,
        width: media.width,
        height: media.height,
        byte_size: media.byte_size,
        content_type: media.content_type,
        room_id: media.room_id,
        validated_at: media.validated_at,
      }),
    )
    .filter((contract) => contract !== null)
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

/**
 * @param panoramas Visites déjà publiées, lorsqu'elles ont été chargées en
 *   amont pour décider de l'éligibilité. Les passer évite une seconde lecture
 *   ET surtout une incohérence : la décision de publier et le corps réellement
 *   transmis ne reposeraient plus sur le même état de la base. Absentes
 *   (dépublication), elles sont relues ici, comme avant.
 */
async function syncSchoolToTrouvetou(
  admin: SupabaseClient,
  schoolId: string,
  published: boolean,
  panoramas?: TrouvetouMediaContract[],
) {
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

  // Visites 360° réellement publiées. LECTURE AVANT la construction du
  // payload : une erreur de lecture doit interrompre la synchronisation, sinon
  // Trouvetou recevrait une fiche sans panoramas et effacerait les visites
  // qu'il affiche déjà.
  const publishedPanoramas = panoramas ?? (await loadPublishedPanoramas(admin, schoolId))

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
    // NOUVEAU (§12) : contrat riche des visites 360° publiées. Ajouté À CÔTÉ
    // de `photos_360`, jamais à sa place : `cover_photo`, `gallery` et
    // `photos_360` continuent d'arriver exactement comme avant, comme l'exige
    // le contrat. Tableau vide quand l'établissement n'a rien de publié —
    // Trouvetou le traitera comme « aucune visite », pas comme une erreur.
    panoramas: publishedPanoramas,
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
  if (!response.ok || body?.ok !== true) {
    throw new Error(body?.error || ("Trouvetou a refusé la synchronisation (" + response.status + ")"))
  }
  return { levels: niveaux.length, result: body?.result ?? null }
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

    // Chargé avant toute décision, et réutilisé tel quel par la
    // synchronisation : une seule lecture de `school_media`, et surtout aucune
    // fenêtre entre « l'établissement est publiable » et « ce que l'on envoie ».
    let publishedPanoramas: TrouvetouMediaContract[] | undefined

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

      // Photos classiques : définition INCHANGÉE. `photos_360` reste lu ici
      // parce qu'il fait partie de l'historique des fiches publiées ; il ne sert
      // toutefois plus à décider à lui seul (voir `hasPublishedPanorama`).
      const hasClassicPhoto = Boolean(
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

      // Source de vérité du nouveau parcours : `school_media`, filtrée en base
      // sur `kind = panorama_360` ET `status = published`. Un panorama
      // `uploaded`, `validated` ou `rejected` ne débloque RIEN —
      // `loadPublishedPanoramas` filtre déjà, donc la liste obtenue ne contient
      // que des visites publiables. Une simple ligne dans `school_media`, même
      // présente, ne suffirait pas.
      publishedPanoramas = await loadPublishedPanoramas(admin, role.school_id)
      const hasPublishedPanorama = publishedPanoramas.length > 0

      if (!hasClassicPhoto && !hasPublishedPanorama) {
        return NextResponse.json(
          {
            error: "Publication impossible : ajoutez au moins une photo, ou importez puis publiez une photo 360°, avant de publier la fiche Trouvetou.",
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
      return NextResponse.json({
        success: true,
        published: nextPublished,
        trouvetou: { synced: true, levels: sync.levels, result: sync.result },
      })
    } catch (syncError) {
      await admin
        .from("schools")
        .update({ published_to_trouvetou: !nextPublished })
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
