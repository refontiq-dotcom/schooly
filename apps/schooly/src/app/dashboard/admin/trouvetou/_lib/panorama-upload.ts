/**
 * Pré-contrôles et traduction des erreurs pour l'import d'une visite 360°.
 *
 * Règle absolue de ce module : il ne prétend JAMAIS qu'un fichier est une
 * vraie photographie 360°. Un ratio 2:1 prouve une géométrie, pas une prise
 * de vue panoramique. Le seul juge est `validatePanorama` côté serveur, qui
 * mesure notamment le raccord bord droit / bord gauche — la seule mesure qui,
 * elle, distingue une image 2:1 assemblée d'un simple visuel étiré.
 *
 * Les seuils ci-dessous sont la copie client des règles serveur. Ils sont
 * volontairement redéclarés plutôt qu'importés : `panorama-validator.ts`
 * importe `sharp` et ne peut donc pas entrer dans le bundle du navigateur.
 * Sources à garder synchronisées :
 *   - `MAX_BYTES`                    → `media/panorama/route.ts` (POST)
 *   - `ALLOWED_MIME`                 → `media/panorama-validator.ts`
 *   - `minWidth`/`minHeight`/`ratio` → `DEFAULT_PANORAMA_THRESHOLDS`
 */

export const PANORAMA_MAX_BYTES = 15 * 1024 * 1024
export const PANORAMA_MIN_WIDTH = 3000
export const PANORAMA_MIN_HEIGHT = 1500
export const PANORAMA_RATIO = 2
export const PANORAMA_RATIO_TOLERANCE = 0.02

export const PANORAMA_ALLOWED_MIME: readonly string[] = ["image/jpeg", "image/png", "image/webp"]
export const PANORAMA_ACCEPT_ATTRIBUTE = PANORAMA_ALLOWED_MIME.join(",")

/** Codes produits par `decideFromReport` côté serveur. */
export type PanoramaRejectionCode =
  | "invalid_mime"
  | "unreadable_file"
  | "too_large"
  | "invalid_ratio"
  | "invalid_resolution"
  | "torn_seam"
  | "black_zones"

/** Forme du rapport renvoyé par le PUT de validation. */
export type PanoramaCheck = { id: string; status: string; detail: string; value?: number }
export type PanoramaReport = {
  status: string
  checks: PanoramaCheck[]
  width?: number
  height?: number
  ratio?: number
  byteSize?: number
  format?: string
  summary: string
}

export const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${bytes} o`
}


export const MAX_BYTES_LABEL = formatBytes(PANORAMA_MAX_BYTES)
export const ACCEPTED_FORMATS_LABEL = "JPEG, PNG ou WebP"

/**
 * Un contrôle d'amorce : il bloque l'envoi quand le fichier ne peut pas
 * aboutir, et n'exige rien quand la mesure n'a pas pu être faite.
 */
export type PanoramaPrecheck = { blocking: boolean; message: string }

const RATIO_SLACK = PANORAMA_RATIO * PANORAMA_RATIO_TOLERANCE

/** Titre court expliquant un rejet, avant le détail technique du serveur. */
const REJECTION_HEADLINES: Record<PanoramaRejectionCode, string> = {
  invalid_mime: "Format non pris en charge",
  unreadable_file: "Image illisible",
  too_large: "Fichier trop volumineux",
  invalid_ratio: "Ratio incorrect",
  invalid_resolution: "Résolution insuffisante",
  torn_seam: "Raccord gauche/droite non conforme",
  black_zones: "Zones noires excessives",
}

/** Contrôles déduits du seul en-tête du fichier : type MIME et poids. */
export function precheckFileHeader(file: { type: string; size: number }): PanoramaPrecheck | null {
  if (!PANORAMA_ALLOWED_MIME.includes(file.type)) {
    return { blocking: true, message: `Format non pris en charge : ${ACCEPTED_FORMATS_LABEL} uniquement.` }
  }
  if (file.size <= 0) return { blocking: true, message: "Le fichier sélectionné est vide." }
  if (file.size > PANORAMA_MAX_BYTES) {
    return { blocking: true, message: `Fichier trop volumineux (${MAX_BYTES_LABEL} maximum).` }
  }
  return null
}

/**
 * Contrôles déduits des dimensions réelles lues par le navigateur.
 *
 * Un fichier que le navigateur ne sait pas décoder rend `null` : on ne bloque
 * jamais sur une mesure impossible à obtenir, le serveur tranchera.
 */
export function precheckDimensions(width: number, height: number): PanoramaPrecheck | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null

  const ratio = width / height
  if (Math.abs(ratio - PANORAMA_RATIO) > RATIO_SLACK) {
    return {
      blocking: true,
      message: `Ratio incorrect : ${ratio.toFixed(2)}:1. Une visite 360° doit être en 2:1 exactement (largeur = 2 × hauteur).`,
    }
  }
  if (width < PANORAMA_MIN_WIDTH || height < PANORAMA_MIN_HEIGHT) {
    return {
      blocking: true,
      message: `Résolution insuffisante : ${width}×${height}. Il faut au moins ${PANORAMA_MIN_WIDTH}×${PANORAMA_MIN_HEIGHT}.`,
    }
  }
  return null
}


/** Table inverse de `REJECTION_TO_CHECK_ID` (panorama-state.ts). */
const CHECK_ID_TO_CODE: Record<string, PanoramaRejectionCode> = {
  mime: "invalid_mime",
  readable: "unreadable_file",
  size: "too_large",
  ratio: "invalid_ratio",
  resolution: "invalid_resolution",
  seam: "torn_seam",
  black: "black_zones",
}

/**
 * Relit le motif de rejet dans le rapport renvoyé par le serveur.
 *
 * Le PUT ne renvoie pas `rejection_code` : il renvoie le rapport. On ne
 * rejoue donc PAS la décision ici — la décision reste au serveur — on se
 * contente de retrouver le contrôle en échec pour l'habiller. Le rapport
 * complet est affiché tel quel à côté, controls FAIL compris.
 */
export function rejectionFromReport(report: PanoramaReport | null | undefined): {
  code: PanoramaRejectionCode
  details: string
} | null {
  const failed = report?.checks.find((check) => check.status === "FAIL" && check.id in CHECK_ID_TO_CODE)
  if (!failed) return null
  return { code: CHECK_ID_TO_CODE[failed.id], details: failed.detail }
}


/** Ce que l'établissement doit faire, dans sa langue, après un rejet. */
const REJECTION_ACTIONS: Record<PanoramaRejectionCode, string> = {
  invalid_mime: `Réexporte ta visite 360° en ${ACCEPTED_FORMATS_LABEL}, puis réessaie.`,
  unreadable_file: "Le fichier a peut-être été déplacé ou endommagé. Réessaie avec une autre exportation.",
  too_large: `Réexporte ta visite 360° en dessous de ${MAX_BYTES_LABEL}, ou utilise un format plus compact.`,
  invalid_ratio: "Réexporte ta visite 360° depuis la caméra 360° ou l'application de stitching, en projection 2:1.",
  invalid_resolution: `Réexporte ta visite 360° avec au moins ${PANORAMA_MIN_WIDTH}×${PANORAMA_MIN_HEIGHT} pixels.`,
  torn_seam:
    "Le bord droit et le bord gauche de l'image ne se rejoignent pas : l'assemblage est incomplet. Refais-le avec l'application de stitching.",
  black_zones: "L'image contient des zones noires. Refais l'assemblage en incluant toutes les directions de prise de vue.",
}

/** Un rejet inconnu ne doit jamais laisser l'écran vide. */
export function describeRejection(
  code: string | null | undefined,
  details: string | null | undefined,
): { headline: string; action: string; detail: string | null } {
  const known = code as PanoramaRejectionCode | null
  const safe = known && known in REJECTION_HEADLINES ? known : null
  return {
    headline: safe ? REJECTION_HEADLINES[safe] : "Visite 360° refusée",
    action: safe ? REJECTION_ACTIONS[safe] : "Vérifie ton export puis réessaie.",
    detail: typeof details === "string" && details.trim() ? details : null,
  }
}

/**
 * Traduit un échec HTTP en phrase utilisable par un directeur d'établissement.
 *
 * Le message du serveur n'est repris que s'il est déjà écrit en clair : les
 * messages techniques inutilisables (« Erreur validation ») sont écartés au
 * profit d'une formulation stable.
 */
export function humanizeApiError(status: number, serverMessage: string | null | undefined): string {
  const raw = typeof serverMessage === "string" ? serverMessage.trim() : ""

  if (status === 0) return "Connexion interrompue. Vérifie ton accès internet puis réessaie."
  if (status === 400 && raw) return raw
  if (status === 403) return "Ton compte n'est pas autorisé à gérer les médias de cet établissement."
  if (status === 404) return "Ce dépôt n'existe plus. Recommence l'import depuis le début."
  if (status === 409 && raw) return raw
  if (status === 409) return "Cette visite 360° n'est pas publiable dans son état actuel."
  if (status === 413) return `Fichier trop volumineux (${MAX_BYTES_LABEL} maximum).`
  if (status === 503) return "Stockage des médias momentanément indisponible. Réessaie dans un instant."
  if (status >= 500) return "Erreur temporaire du serveur. Réessaie dans un instant."
  return raw || "L'import a échoué. Réessaie."
}

