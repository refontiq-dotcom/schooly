import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { logServerEvent } from "@/lib/server-logger"
import {
  MEDIA_KINDS,
  MEDIA_MAX_BYTES,
  deleteMediaObject,
  isAllowedMediaType,
  isKeyOwnedBySchool,
  mediaObjectExists,
  presignMediaUpload,
  r2KeyFromPublicUrl,
  readR2Config,
  type MediaKind,
} from "@/lib/storage/r2"

const QUOTA_CLASSIC_PHOTOS = 4
const QUOTA_360 = 1

/**
 * Fabrique du client Supabase service (contourne le RLS).
 *
 * Le type du client est déduit de CET appel et non de `createAdminClient` :
 * `ReturnType<typeof createClient>` retomberait sur les paramètres génériques
 * par défaut de la bibliothèque et ferait perdre tout typage de colonne.
 */
function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type AdminClient = ReturnType<typeof createAdmin>

type AuthorizedContext = {
  admin: AdminClient
  schoolId: string
}

/**
 * Résout l'établissement de l'appelant à partir de son rôle en base.
 *
 * L'identifiant d'établissement ne vient JAMAIS du navigateur. C'est la seule
 * façon d'interdire d'écrire — ou de supprimer — dans le namespace d'un autre
 * établissement, y compris en forgeant un `schoolId` dans le corps de la requête
 * ou une clé R2 « bien formée » pointant ailleurs.
 *
 * Renvoie une `NextResponse` d'erreur si l'appelant n'est pas autorisé : les
 * appelers testent avec `instanceof NextResponse` et la renvoient telle quelle.
 */
async function requireTrouvetouAdmin(): Promise<AuthorizedContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

  const admin = createAdmin()
  const { data: role } = await admin
    .from("user_school_roles")
    .select("school_id, role_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role_code", [...TROUVETOU_ADMIN_ROLES])
    .maybeSingle()

  if (!role) return NextResponse.json({ error: "Non autorise" }, { status: 403 })
  return { admin, schoolId: role.school_id }
}

/**
 * POST /api/v1/admin/trouvetou/media
 *
 * N'uploade plus le fichier : autorise un upload et renvoie où l'envoyer.
 * Le navigateur fait ensuite un PUT direct sur Cloudflare R2 avec l'URL signée
 * reçue ici. Le fichier ne passe donc jamais par la fonction Next.js, ce qui
 * permet de dépasser la limite de 4,5 Mo du corps de requête sur Vercel Hobby.
 *
 * Le contrôle de quota reste ici, côté serveur : c'est le seul endroit qui fait
 * autorité avant que l'objet n'existe.
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    // Métadonnées uniquement : le fichier lui-même n'est plus transmis ici.
    const payload: unknown = await request.json()
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const kind = typeof body.kind === "string" ? body.kind : "gallery"
    const contentType = body.contentType
    const size = typeof body.size === "number" ? body.size : 0

    if (!MEDIA_KINDS.includes(kind as MediaKind)) {
      return NextResponse.json({ error: "Type de media invalide" }, { status: 400 })
    }

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("cover_photo_url, gallery_photos, photos_360")
      .eq("id", schoolId)
      .maybeSingle()
    if (schoolError || !school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 })

    const galleryCount = Array.isArray(school.gallery_photos)
      ? school.gallery_photos.filter((item) => typeof item === "string" && item.trim()).length
      : 0
    const hasCover = typeof school.cover_photo_url === "string" && school.cover_photo_url.trim().length > 0
    const has360 = Array.isArray(school.photos_360)
      ? school.photos_360.some((item) => typeof item === "string" && item.trim())
      : false

    if (kind === "gallery" && galleryCount + (hasCover ? 1 : 0) >= QUOTA_CLASSIC_PHOTOS) {
      return NextResponse.json(
        { error: `Maximum ${QUOTA_CLASSIC_PHOTOS} photos classiques, photo principale comprise.` },
        { status: 400 },
      )
    }
    if (kind === "360" && has360) {
      return NextResponse.json(
        { error: `Une seule visite 360° est autorisée par établissement.` },
        { status: 400 },
      )
    }

    if (!isAllowedMediaType(contentType)) {
      return NextResponse.json({ error: "Format accepte : JPG, PNG ou WebP" }, { status: 400 })
    }
    if (size <= 0) {
      return NextResponse.json({ error: "Image requise" }, { status: 400 })
    }
    if (size > MEDIA_MAX_BYTES) {
      return NextResponse.json(
        { error: `Image trop volumineuse (${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} Mo maximum)` },
        { status: 400 },
      )
    }

    const isPanorama = kind === "360"
    const logEvent = isPanorama ? "panorama" : "media"

    const config = readR2Config()
    if (!config) {
      logServerEvent("error", `${logEvent}_upload_failed`, {
        request_id: requestId,
        school_id: schoolId,
        kind,
        reason: "r2_not_configured",
      })
      return NextResponse.json({ error: "Stockage média indisponible." }, { status: 503 })
    }

    logServerEvent("info", `${logEvent}_upload_started`, {
      request_id: requestId,
      school_id: schoolId,
      kind,
      content_type: contentType,
      size_bytes: size,
    })

    const presigned = await presignMediaUpload({
      schoolId,
      kind: kind as MediaKind,
      contentType,
      config,
    })
    // Ni l'URL signée ni aucune credential ne sont journalisées : seule la clé
    // l'est, elle ne vaut rien sans la signature.
    logServerEvent("info", `${logEvent}_upload_succeeded`, {
      request_id: requestId,
      school_id: schoolId,
      kind,
      key: presigned.key,
      size_bytes: size,
    })
    return NextResponse.json({ success: true, kind, ...presigned })
  } catch (error: unknown) {
    logServerEvent("error", "media_upload_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 })
  }
}

type MediaColumn = "cover_photo_url" | "gallery_photos" | "photos_360"

function asUrlList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

/**
 * Retire la référence du média de la colonne concernée.
 *
 * Écritures explicites par colonne plutôt qu'une clé calculée : le typage
 * Supabase reste vérifié par le compilateur, et `cover_photo_url` est un texte
 * simple alors que les deux autres sont des jsonb.
 */
async function removeMediaReference(
  admin: AdminClient,
  schoolId: string,
  column: MediaColumn,
  url: string,
  current: string[],
) {
  if (column === "cover_photo_url") {
    return admin.from("schools").update({ cover_photo_url: null }).eq("id", schoolId)
  }
  const remaining = current.filter((value) => value !== url)
  if (column === "gallery_photos") {
    return admin.from("schools").update({ gallery_photos: remaining }).eq("id", schoolId)
  }
  return admin.from("schools").update({ photos_360: remaining }).eq("id", schoolId)
}

/**
 * DELETE /api/v1/admin/trouvetou/media  —  corps : `{ "url": "<url publique>" }`
 *
 * Supprime réellement l'objet dans le bucket R2, puis la référence en base.
 * L'ordre est délibéré : si R2 échoue on n'écrit rien et l'interface peut
 * réessayer ; l'inverse laisserait un fichier orphelin, impossible à retrouver
 * depuis l'interface puisque la base ne garderait plus son URL.
 *
 * Garde-fous, dans cet ordre :
 *  1. l'URL est-elle une référence de CET établissement (lu en base) ;
 *  2. la clé déduite appartient-elle à CET établissement (structure de clé) ;
 *  3. aucune clé fournie par le navigateur n'est jamais utilisée telle quelle.
 */
export async function DELETE(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    const payload: unknown = await request.json().catch(() => ({}))
    const rawUrl =
      typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).url : null
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json({ error: "URL du média requise" }, { status: 400 })
    }
    const url = rawUrl.trim()

    const config = readR2Config()
    if (!config) {
      logServerEvent("error", "media_delete_failed", {
        request_id: requestId,
        school_id: schoolId,
        reason: "r2_not_configured",
      })
      return NextResponse.json({ error: "Stockage média indisponible." }, { status: 503 })
    }

    const { data: school } = await admin
      .from("schools")
      .select("cover_photo_url, gallery_photos, photos_360")
      .eq("id", schoolId)
      .maybeSingle()
    if (!school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 })

    const candidates: Array<{ column: MediaColumn; values: string[] }> = [
      { column: "cover_photo_url", values: school.cover_photo_url ? [school.cover_photo_url] : [] },
      { column: "gallery_photos", values: asUrlList(school.gallery_photos) },
      { column: "photos_360", values: asUrlList(school.photos_360) },
    ]
    const target = candidates.find((candidate) => candidate.values.includes(url))
    if (!target) {
      return NextResponse.json({ error: "Média introuvable pour cet établissement" }, { status: 404 })
    }

    const isPanorama = target.column === "photos_360"
    const logEvent = isPanorama ? "panorama" : "media"

    const key = r2KeyFromPublicUrl(config.publicBaseUrl, url)
    if (!key) {
      logServerEvent("warn", `${logEvent}_delete_failed`, {
        request_id: requestId,
        school_id: schoolId,
        reason: "url_not_in_r2_base",
      })
      return NextResponse.json({ error: "Média non supprimable" }, { status: 400 })
    }
    if (!isKeyOwnedBySchool(key, schoolId)) {
      logServerEvent("error", `${logEvent}_delete_failed`, {
        request_id: requestId,
        school_id: schoolId,
        reason: "key_belongs_to_other_school",
      })
      return NextResponse.json({ error: "Média non supprimable" }, { status: 403 })
    }

    // DeleteObject est idempotent chez R2 : sans ce HEAD on ne distinguerait pas
    // « supprimé » de « n'a jamais existé ».
    const existed = await mediaObjectExists({ key, config })
    if (!existed) {
      logServerEvent("warn", "r2_object_not_found", {
        request_id: requestId,
        school_id: schoolId,
        key,
      })
    }

    await deleteMediaObject({ key, config })

    const { error: updateError } = await removeMediaReference(admin, schoolId, target.column, url, target.values)
    if (updateError) {
      // L'objet est supprimé mais la base le référence encore : on le dit
      // explicitement plutôt que de laisser une image cassée sans trace.
      logServerEvent("error", `${logEvent}_delete_failed`, {
        request_id: requestId,
        school_id: schoolId,
        key,
        reason: "supabase_update_failed_after_r2_delete",
      })
      return NextResponse.json(
        { error: "Média supprimé du stockage, mais sa référence reste à purger." },
        { status: 500 },
      )
    }

    logServerEvent("info", `${logEvent}_delete_succeeded`, {
      request_id: requestId,
      school_id: schoolId,
      key,
      column: target.column,
      existed_in_bucket: existed,
    })
    return NextResponse.json({ success: true, key, existed_in_bucket: existed })
  } catch (error: unknown) {
    logServerEvent("error", "media_delete_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 })
  }
}
