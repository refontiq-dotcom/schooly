import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TROUVETOU_ADMIN_ROLES } from "@/utils/supabase/roles"
import { logServerEvent } from "@/lib/server-logger"
import {
  MEDIA_KINDS,
  MEDIA_MAX_BYTES,
  isAllowedMediaType,
  presignMediaUpload,
  readR2Config,
  type MediaKind,
} from "@/lib/storage/r2"

const QUOTA_CLASSIC_PHOTOS = 4
const QUOTA_360 = 1

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
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 })

    const admin = createAdminClient(
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
      .eq("id", role.school_id)
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

    const config = readR2Config()
    if (!config) {
      logServerEvent("error", "trouvetou.media.r2_not_configured", {
        school_id: role.school_id,
      })
      return NextResponse.json({ error: "Stockage média indisponible." }, { status: 503 })
    }

    const presigned = await presignMediaUpload({
      schoolId: role.school_id,
      kind: kind as MediaKind,
      contentType,
      config,
    })
    return NextResponse.json({ success: true, kind, ...presigned })
  } catch (error: unknown) {
    logServerEvent("error", "trouvetou.media.failed", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 })
  }
}
