/**
 * Flux 360° — authorization d'upload, validation, publication, suppression.
 *
 * Le fichier n'est jamais hébergé par cette route : elle autorise, puis relit
 * ce que le navigateur a réellement déposé dans R2, et décide. C'est la seule
 * façon de valider des pixels — voir `readMediaObject`.
 *
 * Aucune conversion n'est faite ici : une photo 4:3 envoyée sur ce point de
 * terminaison est REJETÉE, pas « transformée en panorama ». Le stitching reste
 * une brique à part.
 */
import { NextResponse } from "next/server"
import { requireTrouvetouAdmin } from "@/lib/trouvetou/admin-auth"
import { logServerEvent } from "@/lib/server-logger"
import {
  isAllowedMediaType,
  buildMediaKeyFor,
  deleteMediaObject,
  isKeyOwnedBySchool,
  publicMediaUrl,
  presignMediaUpload,
  readMediaObject,
  readR2Config,
} from "@/lib/storage/r2"
import { validatePanorama } from "@/lib/media/panorama-validator"
import { canPublish, decideFromReport } from "@/lib/media/panorama-state"

const KIND = "360" as const
const MEDIA_KIND = "panorama_360" as const

/** Une visite 360° fait 15 Mo au maximum, borne de R2 bien plus large. */
const MAX_BYTES = 15 * 1024 * 1024

/**
 * POST — autorise un dépôt et renvoie où l'envoyer.
 *
 * Le `mediaId` est tiré ici et sert à la fois d'identifiant de ligne
 * `school_media` et de suffixe de clé R2 : les deux se déduisent l'un de
 * l'autre, sans colonne redondante.
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    const payload: unknown = await request.json().catch(() => ({}))
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const contentType = body.contentType
    const size = typeof body.size === "number" ? body.size : 0

    if (!isAllowedMediaType(contentType)) {
      return NextResponse.json({ error: "Format accepté : JPG, PNG ou WebP" }, { status: 400 })
    }
    if (size <= 0) {
      return NextResponse.json({ error: "Image requise" }, { status: 400 })
    }
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image trop volumineuse (${Math.round(MAX_BYTES / (1024 * 1024))} Mo maximum)` },
        { status: 400 },
      )
    }

    const config = readR2Config()
    if (!config) {
      logServerEvent("error", "panorama_upload_failed", {
        request_id: requestId,
        school_id: schoolId,
        reason: "r2_not_configured",
      })
      return NextResponse.json({ error: "Stockage média indisponible." }, { status: 503 })
    }

    const mediaId = crypto.randomUUID()
    const presigned = await presignMediaUpload({
      schoolId,
      kind: KIND,
      contentType,
      config,
      mediaId,
    })

    // La ligne naît ICI, au statut `uploaded` : le dépôt est autorisé mais pas
    // encore contrôlé. Le PUT de validation la fera passer à `validated` ou
    // `rejected`. Sans cette ligne, le PUT n'aurait rien à retrouver et un
    // dépôt abandonné resterait invisible en base.
    const { error: insertError } = await admin.from("school_media").insert({
      id: mediaId,
      school_id: schoolId,
      kind: MEDIA_KIND,
      r2_key: presigned.key,
      public_url: presigned.publicUrl,
      content_type: contentType,
      status: "uploaded",
    })
    if (insertError) throw insertError

    logServerEvent("info", "panorama_upload_started", {
      request_id: requestId,
      school_id: schoolId,
      media_id: mediaId,
      key: presigned.key,
      size_bytes: size,
      content_type: contentType,
    })

    return NextResponse.json({
      success: true,
      mediaId,
      key: presigned.key,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      headers: presigned.headers,
    })
  } catch (error: unknown) {
    logServerEvent("error", "panorama_upload_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur upload" }, { status: 500 })
  }
}

/**
 * PUT — valide le dépôt et enregistre le média.
 *
 * Le corps ne fournit QUE l'identifiant du média. Tout le reste — ratio,
 * résolution, raccord — est mesuré sur les octets relus depuis R2. Un client
 * qui déclare un panorama 2:1 en envoyant une photo 4:3 se fait refuser ici.
 */
export async function PUT(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    const payload: unknown = await request.json().catch(() => ({}))
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : ""
    if (!mediaId) return NextResponse.json({ error: "Identifiant du média requis" }, { status: 400 })

    const config = readR2Config()
    if (!config) return NextResponse.json({ error: "Stockage média indisponible." }, { status: 503 })

    // La ligne est filtrée par établissement : impossible de valider — donc
    // d'écrire — un dépôt appartenant à une autre école.
    const { data: pending } = await admin
      .from("school_media")
      .select("id, r2_key, content_type, status")
      .eq("id", mediaId)
      .eq("school_id", schoolId)
      .maybeSingle()
    if (!pending) {
      return NextResponse.json({ error: "Dépôt inconnu pour cet établissement" }, { status: 404 })
    }
    if (!isKeyOwnedBySchool(pending.r2_key, schoolId)) {
      logServerEvent("error", "panorama_upload_failed", {
        request_id: requestId,
        school_id: schoolId,
        media_id: mediaId,
        reason: "key_belongs_to_other_school",
      })
      return NextResponse.json({ error: "Dépôt refusé" }, { status: 403 })
    }

    const bytes = await readMediaObject({ key: pending.r2_key, config })
    if (!bytes) {
      logServerEvent("warn", "r2_object_not_found", {
        request_id: requestId,
        school_id: schoolId,
        media_id: mediaId,
        key: pending.r2_key,
      })
      return NextResponse.json({ error: "Fichier introuvable dans le stockage." }, { status: 400 })
    }

    const report = await validatePanorama(bytes, pending.content_type)
    const decision = decideFromReport(report)

    const { error: upsertError } = await admin
      .from("school_media")
      .update({
        status: decision.status,
        rejection_code: decision.rejectionCode,
        rejection_details: decision.rejectionDetails,
        validation: report as unknown as Record<string, unknown>,
        byte_size: bytes.length,
        width: report.width ?? null,
        height: report.height ?? null,
        validated_at: decision.status === "validated" ? new Date().toISOString() : null,
      })
      .eq("id", mediaId)
      .eq("school_id", schoolId)
    if (upsertError) throw upsertError

    logServerEvent(decision.status === "validated" ? "info" : "warn", "panorama_upload_succeeded", {
      request_id: requestId,
      school_id: schoolId,
      media_id: mediaId,
      key: pending.r2_key,
      outcome: decision.status,
      rejection_code: decision.rejectionCode,
      ratio: report.ratio,
      width: report.width,
      height: report.height,
    })

    return NextResponse.json({
      success: decision.status === "validated",
      mediaId,
      status: decision.status,
      summary: report.summary,
      report,
    })
  } catch (error: unknown) {
    logServerEvent("error", "panorama_upload_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur validation" }, { status: 500 })
  }
}


/**
 * PATCH — publication.
 *
 * Seule une visite `validated` devient `published`. La publication remplace
 * l'éventuelle visite déjà publiée pour l'établissement : l'index unique
 * `uniq_school_media_published_panorama` l'impose, et l'ancienne repasse donc
 * en `validated` plutôt que de rester publiée et de faire doublon.
 */
export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    const payload: unknown = await request.json().catch(() => ({}))
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : ""
    if (!mediaId) return NextResponse.json({ error: "Identifiant du média requis" }, { status: 400 })

    const { data: media } = await admin
      .from("school_media")
      .select("id, status, r2_key")
      .eq("id", mediaId)
      .eq("school_id", schoolId)
      .maybeSingle()
    if (!media) return NextResponse.json({ error: "Média introuvable" }, { status: 404 })

    if (!canPublish(media.status)) {
      logServerEvent("warn", "panorama_publish_refused", {
        request_id: requestId,
        school_id: schoolId,
        media_id: mediaId,
        status: media.status,
      })
      return NextResponse.json(
        { error: `Une visite au statut « ${media.status} » ne peut pas être publiée.` },
        { status: 409 },
      )
    }

    await admin
      .from("school_media")
      .update({ status: "validated", published_at: null })
      .eq("school_id", schoolId)
      .eq("kind", MEDIA_KIND)
      .eq("status", "published")
      .is("room_id", null)

    const { error } = await admin
      .from("school_media")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", mediaId)
      .eq("school_id", schoolId)
    if (error) throw error

    logServerEvent("info", "panorama_publish_succeeded", {
      request_id: requestId,
      school_id: schoolId,
      media_id: mediaId,
      key: media.r2_key,
    })
    return NextResponse.json({ success: true, mediaId, status: "published" })
  } catch (error: unknown) {
    logServerEvent("error", "panorama_publish_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur publication" }, { status: 500 })
  }
}

/**
 * DELETE — retire l'objet R2 puis la ligne.
 *
 * R2 d'abord : si la suppression du fichier échoue, la référence reste en base
 * et l'anomalie est visible. L'inverse laisserait un fichier orphelin que plus
 * personne ne retrouverait, la référence ayant disparu.
 */
export async function DELETE(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const auth = await requireTrouvetouAdmin()
    if (auth instanceof NextResponse) return auth
    const { admin, schoolId } = auth

    const payload: unknown = await request.json().catch(() => ({}))
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : ""
    if (!mediaId) return NextResponse.json({ error: "Identifiant du média requis" }, { status: 400 })

    const { data: media } = await admin
      .from("school_media")
      .select("id, r2_key, status")
      .eq("id", mediaId)
      .eq("school_id", schoolId)
      .maybeSingle()
    if (!media) return NextResponse.json({ error: "Média introuvable" }, { status: 404 })
    if (!isKeyOwnedBySchool(media.r2_key, schoolId)) {
      return NextResponse.json({ error: "Suppression refusée" }, { status: 403 })
    }

    const config = readR2Config()
    if (config) {
      // Si l'objet ne part pas, la ligne reste. Supprimer la référence malgré
      // l'échec laisserait un fichier orphelin que plus personne ne retrouverait
      // — la référence ayant disparu, impossible à lister ni à nettoyer.
      try {
        await deleteMediaObject({ key: media.r2_key, config })
      } catch (storageErr) {
        logServerEvent("error", "panorama_delete_failed", {
          request_id: requestId,
          school_id: schoolId,
          media_id: mediaId,
          key: media.r2_key,
          reason: "r2_delete_failed",
          detail: storageErr instanceof Error ? storageErr.message : "Erreur inconnue",
        })
        return NextResponse.json(
          { error: "Suppression du fichier impossible, opération annulée." },
          { status: 502 },
        )
      }
    }

    const { error } = await admin.from("school_media").delete().eq("id", mediaId).eq("school_id", schoolId)
    if (error) throw error

    logServerEvent("info", "panorama_delete_succeeded", {
      request_id: requestId,
      school_id: schoolId,
      media_id: mediaId,
      key: media.r2_key,
      previous_status: media.status,
    })
    return NextResponse.json({ success: true, mediaId })
  } catch (error: unknown) {
    logServerEvent("error", "panorama_delete_failed", {
      request_id: requestId,
      reason: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 })
  }
}
