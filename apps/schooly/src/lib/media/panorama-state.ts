/**
 * Cycle de vie d'une visite 360° et contrat de publication Trouvetou.
 *
 * Logique volontairement pure : aucun accès réseau ni base de données. Les
 * routes s'en servent pour décider, et les tests peuvent épuiser toutes les
 * transitions sans lever une fonction.
 *
 *   uploaded ──validation──▶ validated ──publication──▶ published
 *        │                      │
 *        └──validation──▶ rejected (terminal)
 *
 * Un rejet est terminal : republier un média rejeté est impossible, sinon la
 * seule chose qui la-separerait de `validated` serait qu'on ne repasse pas par
 * le contrôle.
 */

export type MediaStatus = "uploaded" | "validated" | "rejected" | "published"

export type RejectionCode =
  | "invalid_mime"
  | "unreadable_file"
  | "too_large"
  | "invalid_ratio"
  | "invalid_resolution"
  | "torn_seam"
  | "black_zones"

export const MEDIA_STATUSES: readonly MediaStatus[] = ["uploaded", "validated", "rejected", "published"]

/**
 * Correspondance entre l'échec mesuré par le validateur et un code structuré.
 * Table inverse : on part du motif, on retrouve le contrôle qui l'a produit.
 */
const REJECTION_TO_CHECK_ID: Record<RejectionCode, string> = {
  invalid_mime: "mime",
  unreadable_file: "readable",
  too_large: "size",
  invalid_ratio: "ratio",
  invalid_resolution: "resolution",
  torn_seam: "seam",
  black_zones: "black",
}

const idToCheck = (code: RejectionCode): string => REJECTION_TO_CHECK_ID[code]

/**
 * Ordre de priorité des motifs, du plus fondamental au plus secondaire.
 *
 * Indispensable : le motif retenu doit être le même quel que soit l'ordre dans
 * lequel le validateur a produit ses contrôles. Sans cette liste fixe, un même
 * rapport donnerait « ratio » une fois et « résolution » la fois suivante, et le
 * support verrait une raison différente à chaque recopiage du message.
 */
const REJECTION_PRIORITY: readonly RejectionCode[] = [
  "invalid_mime",
  "unreadable_file",
  "too_large",
  "invalid_ratio",
  "invalid_resolution",
  "torn_seam",
  "black_zones",
]

export type PanoramaCheckLike = { id: string; status: string; detail: string }

/**
 * Statut et motif de rejet déduits d'un rapport de validation.
 */
export function decideFromReport(report: {
  status: string
  checks: PanoramaCheckLike[]
}): { status: "validated" | "rejected"; rejectionCode: RejectionCode | null; rejectionDetails: string | null } {
  const failedIds = new Set(report.checks.filter((c) => c.status === "FAIL").map((c) => c.id))
  const code = REJECTION_PRIORITY.find((candidate) => failedIds.has(idToCheck(candidate)))
  if (!code) {
    // WARNING n'empêche pas la publication : c'est un conseil, pas un refus.
    return { status: "validated", rejectionCode: null, rejectionDetails: null }
  }
  const checkId = idToCheck(code)
  const failed = report.checks.find((c) => c.id === checkId)
  return { status: "rejected", rejectionCode: code, rejectionDetails: failed?.detail ?? null }
}

/** Un média ne peut être publié que s'il a été validé et ne l'a jamais été refusé. */
export function canPublish(status: string): boolean {
  return status === "validated"
}

/** Un média ne part vers Trouvetou que s'il est effectivement publié. */
export function isPublishable(status: string): boolean {
  return status === "published"
}

/** Une transition est-elle autorisée ? Les règles ci-dessus, en une seule vérité. */
export function canTransition(from: MediaStatus, to: MediaStatus): boolean {
  const allowed: Record<MediaStatus, readonly MediaStatus[]> = {
    uploaded: ["validated", "rejected"],
    validated: ["published", "rejected"],
    rejected: [],
    published: ["rejected"],
  }
  return allowed[from].includes(to)
}

export type TrouvetouMediaContract = {
  id: string
  /** Discriminant explicite : Trouvetou doit savoir quel composant afficher. */
  media_type: "photo_360"
  url: string
  width: number | null
  height: number | null
  byte_size: number | null
  content_type: string | null
  room_id: string | null
  /** `panorama_360` impose la projection équirectangulaire 2:1 côté affichage. */
  projection: "equirectangular_2_1"
  validated_at: string | null
}

/**
 * Contrat transmis à Trouvetou pour une visite 360°.
 *
 * Ne renvoie quelque chose que si le média est `published` : une photo non
 * validée ne doit pas pouvoir devenir une annonce publique, même si le script
 * de synchronisation la Rencontre par hasard.
 */
export function toTrouvetouMediaContract(
  media: {
    id: string
    status: string
    r2_key: string
    public_url: string
    width: number | null
    height: number | null
    byte_size: number | null
    content_type: string | null
    room_id: string | null
    validated_at: string | null
  },
): TrouvetouMediaContract | null {
  if (!isPublishable(media.status)) return null
  return {
    id: media.id,
    media_type: "photo_360",
    url: media.public_url,
    width: media.width,
    height: media.height,
    byte_size: media.byte_size,
    content_type: media.content_type,
    room_id: media.room_id,
    projection: "equirectangular_2_1",
    validated_at: media.validated_at,
  }
}