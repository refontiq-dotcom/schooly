/**
 * Stockage objet des médias publics — Cloudflare R2.
 *
 * R2 expose une API compatible S3 : on parle donc au bucket via le SDK AWS,
 * pointé sur l'endpoint R2 (https://<account-id>.r2.cloudflarest.com).
 *
 * L'upload passe par une URL signée, directement du navigateur vers R2 : le
 * fichier ne traverse pas la fonction Next.js. C'est ce qui permet de dépasser
 * la limite de 4,5 Mo du corps de requête imposée par Vercel Hobby — un
 * aller-retour par le serveur rendrait cette limite infranchissable.
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/** Durée de validité d'une URL signée : le temps d'un upload, pas davantage. */
const PRESIGN_TTL_SECONDS = 300

/** Plafond par fichier. 15 Mo : laisse la marge côté client comme côté R2. */
export const MEDIA_MAX_BYTES = 15 * 1024 * 1024

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export type MediaKind = "cover" | "gallery" | "360" | "ad"

export const MEDIA_KINDS: readonly MediaKind[] = ["cover", "gallery", "360", "ad"]

export type PresignedUpload = {
  /** URL temporaire : cible du PUT envoyé par le navigateur. */
  uploadUrl: string
  /** URL publique et stable : c'est celle-ci qu'on stocke en base. */
  publicUrl: string
  /** Chemin de l'objet dans le bucket. */
  path: string
  /**
   * En-têtes à renvoyer tels quels avec le PUT. Ils entrent dans la signature :
   * un `Content-Type` différent de celui signé fait échouer l'upload.
   */
  headers: Record<string, string>
}

type R2Config = {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

/** Le type MIME est-il accepté pour un média d'établissement ? */
export function isAllowedMediaType(contentType: unknown): contentType is string {
  return typeof contentType === "string" && contentType in EXTENSION_BY_CONTENT_TYPE
}

/** Extension de fichier déduite du type MIME (jamais du nom d'origine). */
export function extensionFor(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin"
}

/**
 * Chemin de l'objet. `schoolId` en premier niveau pour qu'une liste du bucket
 * reste lisible et qu'un établissement puisse être purgé d'un coup ; UUID pour
 * éviter toute collision et tout écrasement involontaire.
 */
export function buildMediaPath(schoolId: string, kind: MediaKind, contentType: string): string {
  return `${schoolId}/${kind}/${crypto.randomUUID()}.${extensionFor(contentType)}`
}

/** URL publique d'un objet déjà stocké. */
export function publicMediaUrl(publicBaseUrl: string, path: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/${path}`
}

/**
 * Lit la configuration R2 depuis l'environnement. Renvoie `null` — et non une
 * exception — quand une variable manque : l'appelant transforme ça en 503
 * explicite, au lieu de faire planter la route sur une config absente.
 */
export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null
  return {
    endpoint: `https://${accountId}.r2.cloudflarest.com`,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
  }
}

// Client mémoïsé : le SDK S3 tient une pile de sockets, on n'en veut pas un par
// requête. Clé par endpoint, pour rester correct si la config change à chaud.
const clients = new Map<string, S3Client>()

function getClient(config: R2Config): S3Client {
  const existing = clients.get(config.endpoint)
  if (existing) return existing
  const created = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  clients.set(config.endpoint, created)
  return created
}

/**
 * Signe un PUT vers R2 et renvoie, avec l'URL temporaire, l'URL publique que
 * l'appelant enregistrera ensuite en base.
 */
export async function presignMediaUpload(options: {
  schoolId: string
  kind: MediaKind
  contentType: string
  config: R2Config
}): Promise<PresignedUpload> {
  const { schoolId, kind, contentType, config } = options
  const path = buildMediaPath(schoolId, kind, contentType)
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: path,
    // Rejoué dans la signature : le navigateur doit renvoyer exactement ce
    // Content-Type, sinon R2 refuse (SignatureDoesNotMatch).
    ContentType: contentType,
    // Un an : les URLs sont immuables, on n'a rien à révoquer de court.
    CacheControl: "31536000",
  })
  const uploadUrl = await getSignedUrl(getClient(config), command, { expiresIn: PRESIGN_TTL_SECONDS })
  return {
    uploadUrl,
    publicUrl: publicMediaUrl(config.publicBaseUrl, path),
    path,
    headers: { "Content-Type": contentType },
  }
}