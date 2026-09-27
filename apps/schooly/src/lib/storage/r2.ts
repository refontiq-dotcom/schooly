/**
 * Stockage objet des médias publics — Cloudflare R2.
 *
 * R2 expose une API compatible S3 : on parle donc au bucket via le SDK AWS,
 * pointé sur l'endpoint S3 officiel de R2
 * (https://<account-id>.r2.cloudflarestorage.com).
 *
 * L'upload passe par une URL signée, directement du navigateur vers R2 : le
 * fichier ne traverse pas la fonction Next.js. C'est ce qui permet de dépasser
 * la limite de 4,5 Mo du corps de requête imposée par Vercel Hobby — un
 * aller-retour par le serveur rendrait cette limite infranchissable.
 */

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
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
  /**
   * Clé de l'objet dans le bucket. Conservée dans la réponse (et non en base)
   * pour que la suppression retrouve l'objet sans dépendre du domaine public,
   * qui pourra changer plus tard.
   */
  key: string
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

/** Racine de toutes les clés Schooly dans le bucket. */
const KEY_ROOT = "schooly"

/**
 * Emplacement d'un média selon son genre. La visite 360 est isolée de la
 * galerie : un inventaire du bucket distingue d'un coup d'œil les panoramas.
 */
const KEY_GROUP_BY_KIND: Record<MediaKind, string> = {
  cover: "photos/cover",
  gallery: "photos/gallery",
  "360": "360",
  ad: "ads",
}

/**
 * Environnement logique inscrit dans la clé. Vercel expose VERCEL_ENV
 * (production | preview) ; en local on reste sur development. Sans cela, une
 * prévisualisation et la production partageraient le même préfixe.
 */
export function mediaEnvironment(): string {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "production") return "production"
  if (vercelEnv) return "staging"
  return process.env.NODE_ENV === "production" ? "production" : "development"
}

/**
 * Clé de l'objet, déterministe et unique :
 *
 *   schooly/{environnement}/{groupe}/{etablissement}/{mediaId}.{ext}
 *
 * L'identifiant est un UUID, jamais le nom d'origine : deux utilisateurs
 * peuvent envoyer « 360.jpg », le nom seul serait déjà pris.
 */
export function buildMediaKey(
  schoolId: string,
  kind: MediaKind,
  contentType: string,
  environment: string = mediaEnvironment(),
): string {
  const mediaId = crypto.randomUUID()
  return [KEY_ROOT, environment, KEY_GROUP_BY_KIND[kind], schoolId, `${mediaId}.${extensionFor(contentType)}`].join("/")
}

export type ParsedMediaKey = {
  environment: string
  group: string
  schoolId: string
  mediaId: string
  extension: string
}

/**
 * Découpe une clé R2. Renvoie `null` si la structure n'est pas celle de Schooly :
 * la suppression s'appuie sur ce refus pour ne jamais toucher un objet étranger,
 * y compris s'il se trouvait par erreur dans le même bucket.
 */
export function parseMediaKey(key: string): ParsedMediaKey | null {
  const segments = key.split("/")
  if (segments.length !== 5) return null
  const [root, environment, group, schoolId, fileName] = segments
  if (root !== KEY_ROOT || !environment || !group || !schoolId || !fileName) return null
  const dot = fileName.lastIndexOf(".")
  if (dot <= 0) return null
  return {
    environment,
    group,
    schoolId,
    mediaId: fileName.slice(0, dot),
    extension: fileName.slice(dot + 1),
  }
}

/**
 * L'objet appartient-il à cet établissement ? Garde-fou principal contre la
 * suppression (ou l'écriture) dans le namespace d'un autre établissement :
 * l'identifiant d'établissement vient du rôle serveur, jamais du navigateur.
 */
export function isKeyOwnedBySchool(key: string, schoolId: string): boolean {
  return parseMediaKey(key)?.schoolId === schoolId
}

/**
 * URL publique d'un objet stocké. Point de passage unique : le domaine public
 * (r2.dev aujourd'hui, domaine personnalisé demain) n'est defined qu'à un
 * endroit, le reste de l'application ne fait qu'y ajouter la clé.
 */
export function publicMediaUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`
}

/**
 * Opération inverse : retrouve la clé R2 derrière une URL publique. Renvoie
 * `null` si l'URL n'est pas servie par notre base — c'est-à-dire exactement
 * les URL héritées de Supabase Storage, qu'on refuse derouter vers R2 plutôt
 * que de les inventer.
 */
export function r2KeyFromPublicUrl(publicBaseUrl: string, publicUrl: string): string | null {
  const base = publicBaseUrl.replace(/\/+$/, "")
  if (!publicUrl.startsWith(`${base}/`)) return null
  const key = publicUrl.slice(base.length + 1)
  return key.length > 0 ? key : null
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
    // Endpoint S3 officiel de Cloudflare R2. Surchargable par R2_S3_ENDPOINT
    // pour un émulateur local (MinIO) ou un proxy.
    endpoint: process.env.R2_S3_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
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
 *
 * Le serveur ne dépose rien lui-même : il signe, le navigateur exécute le PUT.
 * C'est ce qui permet de dépasser la limite de 4,5 Mo du corps de requête de
 * Vercel Hobby, et ce qui garantit qu'aucun octet ne transite par la fonction.
 */
export async function presignMediaUpload(options: {
  schoolId: string
  kind: MediaKind
  contentType: string
  config: R2Config
}): Promise<PresignedUpload> {
  const { schoolId, kind, contentType, config } = options
  const key = buildMediaKey(schoolId, kind, contentType)
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    // Rejoué dans la signature : le navigateur doit renvoyer exactement ce
    // Content-Type, sinon R2 refuse (SignatureDoesNotMatch).
    ContentType: contentType,
    // Un an : les URLs sont immuables, on n'a rien à révoquer de court.
    CacheControl: "31536000",
  })
  const uploadUrl = await getSignedUrl(getClient(config), command, { expiresIn: PRESIGN_TTL_SECONDS })
  return {
    uploadUrl,
    publicUrl: publicMediaUrl(config.publicBaseUrl, key),
    key,
    headers: { "Content-Type": contentType },
  }
}

/**
 * L'objet existe-t-il réellement dans le bucket ?
 *
 * Indispensable avant de prétendre qu'un média fonctionne : DeleteObject est
 * idempotent chez R2 (il réussit même sur une clé absente), donc sans ce HEAD
 * on ne distingue pas « supprimé » de « n'a jamais existé ».
 */
export async function mediaObjectExists(options: { key: string; config: R2Config }): Promise<boolean> {
  try {
    await getClient(options.config).send(
      new HeadObjectCommand({ Bucket: options.config.bucket, Key: options.key }),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Supprime l'objet. L'appelant doit avoir vérifié `isKeyOwnedBySchool` avant :
 * cette fonction ne connaît que la clé, elle ne connaît pas les droits.
 */
export async function deleteMediaObject(options: { key: string; config: R2Config }): Promise<void> {
  await getClient(options.config).send(
    new DeleteObjectCommand({ Bucket: options.config.bucket, Key: options.key }),
  )
}