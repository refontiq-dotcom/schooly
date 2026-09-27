/**
 * Contrôle qualité automatique d'une photo panoramique 360°.
 *
 * Le validateur ne « devine » rien : chaque contrôle calcule une mesure sur les
 * pixels réels et la compare à un seuil. Un contrôle qui ne peut pas être mesuré
 * de façon fiable renvoie WARNING, jamais PASS — et jamais FAIL non plus, sauf
 * quand la mesure est formelle (ratio, dimensions, MIME, lisibilité).
 *
 * Format attendu : équirectangulaire 2:1 (largeur = 2 × hauteur). Le panorama
 * étant cyclique, c'est cette géométrie qui impose la continuité entre le bord
 * droit et le bord gauche.
 */
import sharp, { type Metadata } from "sharp"

export type CheckStatus = "PASS" | "WARNING" | "FAIL"

export type CheckResult = {
  id: string
  label: string
  status: CheckStatus
  detail: string
  value?: number
  threshold?: number
}

export type PanoramaReport = {
  status: CheckStatus
  checks: CheckResult[]
  width?: number
  height?: number
  ratio?: number
  byteSize?: number
  format?: string
  summary: string
}

export type PanoramaThresholds = {
  /** Tolérance sur le ratio 2:1, en fraction (0,02 = ±2 %). */
  ratioTolerance: number
  minWidth: number
  minHeight: number
  maxBytes: number
  /** Colonnes comparées de part et d'autre du raccord. */
  seamColumns: number
  /** Au-delà de ce rapport au bruit interne, le raccord est visible. */
  seamRatioLimit: number
  /** Fraction de pixels quasi-noirs au-delà de laquelle on refuse. */
  blackPixelRatio: number
  underexposureLuma: number
  overexposureLuma: number
  /** Variance du Laplacien sous laquelle l'image est probablement molle. */
  blurVariance: number
}

export const DEFAULT_PANORAMA_THRESHOLDS: PanoramaThresholds = {
  ratioTolerance: 0.02,
  minWidth: 3000,
  minHeight: 1500,
  maxBytes: 25 * 1024 * 1024,
  seamColumns: 8,
  seamRatioLimit: 2.5,
  blackPixelRatio: 0.02,
  underexposureLuma: 32,
  overexposureLuma: 225,
  blurVariance: 12,
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

function verdict(checks: CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL"
  if (checks.some((c) => c.status === "WARNING")) return "WARNING"
  return "PASS"
}

function summarize(checks: CheckResult[]): string {
  const failed = checks.filter((c) => c.status === "FAIL")
  const warned = checks.filter((c) => c.status === "WARNING")
  if (failed.length > 0) return `Photo 360° refusée : ${failed[0].detail}`
  if (warned.length > 0) return `Photo 360° acceptée sous réserve : ${warned[0].detail}`
  return "Photo 360° acceptée : panorama 2:1 conforme, tous les contrôles réussis."
}

/**
 * Mesures sur pixels : raccord cyclique, zones noires, exposition, netteté.
 *
 * Travaille sur une version réduite en niveaux de gris — ces contrôles portent
 * sur des grandeurs d'ensemble, pas sur le détail, et la réduction rend le coût
 * indépendant de la résolution réelle.
 */
function pixelChecks(gray: Buffer, w: number, h: number, t: PanoramaThresholds): CheckResult[] {
  const out: CheckResult[] = []

  // Raccord cyclique : le bord droit doit rejoindre le bord gauche.
  //
  // On compare la colonne (w-1-i) à la colonne i. Ces deux points sont distants
  // de (2i+1) pas en traversant la couture — et non d'un pas, contrairement à
  // une paire de colonnes voisines. Sans normaliser par cette distance, un
  // panorama à fort gradient (brique, carrelage) verrait son rapport artificiellement
  // gonflé et serait refusé à tort. On ramène donc chaque écart au coût par pas,
  // comparable à la mesure intérieure.
  const cols = Math.max(1, Math.min(t.seamColumns, Math.floor(w / 4)))
  let seamCost = 0
  for (let i = 0; i < cols; i++) {
    const steps = 2 * i + 1
    for (let y = 0; y < h; y++) {
      seamCost += Math.abs(gray[y * w + (w - 1 - i)] - gray[y * w + i]) / steps
    }
  }
  seamCost /= Math.max(1, cols * h)

  let interiorCost = 0
  let pairs = 0
  const step = Math.max(1, Math.floor(w / 64))
  for (let x = Math.floor(w / 2); x < w - step; x += step) {
    for (let y = 0; y < h; y++) {
      interiorCost += Math.abs(gray[y * w + x] - gray[y * w + x + 1])
      pairs++
    }
  }
  interiorCost /= Math.max(1, pairs)

  if (interiorCost < 1) {
    // Image presque uniforme : le rapport n'aurait aucun sens.
    out.push({
      id: "seam",
      label: "Raccord gauche/droite",
      status: "WARNING",
      detail: "Raccord non mesurable : l'image est presque uniforme, ce qui n'est pas un panorama exploitable.",
    })
  } else {
    const ratio = seamCost / interiorCost
    const ok = ratio <= t.seamRatioLimit
    out.push({
      id: "seam",
      label: "Raccord gauche/droite",
      status: ok ? "PASS" : "FAIL",
      detail: ok
        ? `Raccord continu : discontinuité ${ratio.toFixed(2)}× le bruit interne.`
        : `Raccord visible : discontinuité ${ratio.toFixed(2)}× le bruit interne. La photo n'a probablement pas été assemblée correctement.`,
      value: Number(ratio.toFixed(2)),
      threshold: t.seamRatioLimit,
    })
  }

  let dark = 0
  let sum = 0
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i]
    if (v <= 8) dark++
    sum += v
  }
  const mean = sum / Math.max(1, gray.length)
  const darkRatio = dark / Math.max(1, gray.length)

  out.push({
    id: "black",
    label: "Zones noires",
    status: darkRatio > t.blackPixelRatio ? "FAIL" : "PASS",
    detail:
      darkRatio > t.blackPixelRatio
        ? `${(darkRatio * 100).toFixed(1)} % de pixels quasi-noirs : la photo présente des trous ou un nadir manquant.`
        : `Aucun trou notable (${(darkRatio * 100).toFixed(2)} % de pixels quasi-noirs).`,
    value: Number(darkRatio.toFixed(4)),
    threshold: t.blackPixelRatio,
  })

  const exposureOk = mean >= t.underexposureLuma && mean <= t.overexposureLuma
  out.push({
    id: "exposure",
    label: "Exposition",
    status: exposureOk ? "PASS" : "WARNING",
    detail: exposureOk
      ? `Exposition correcte (luminance moyenne ${mean.toFixed(0)}).`
      : mean < t.underexposureLuma
        ? `Photo très sombre (luminance moyenne ${mean.toFixed(0)}) : la visite paraîtra sous-exposée.`
        : `Photo très claire (luminance moyenne ${mean.toFixed(0)}) : les détails sont probablement brûlés.`,
    value: Number(mean.toFixed(1)),
  })

  // Netteté : variance du Laplacien. Mesure classique, mais elle ne distingue
  // pas « flou » de « scène sans détail » — d'où WARNING, jamais FAIL.
  let sumLap = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w]
      sumLap += lap
      sumSq += lap * lap
      n++
    }
  }
  const lapVariance = n > 0 ? sumSq / n - (sumLap / n) ** 2 : 0
  out.push({
    id: "sharpness",
    label: "Netteté",
    status: lapVariance >= t.blurVariance ? "PASS" : "WARNING",
    detail:
      lapVariance >= t.blurVariance
        ? "Netteté suffisante d'après la mesure de contraste local."
        : "Image peu contrastée : elle peut être floue, mais cette mesure ne distingue pas une image floue d'une scène sans détail. À vérifier à l'œil.",
    value: Number(lapVariance.toFixed(1)),
    threshold: t.blurVariance,
  })

  return out
}


/**
 * Analyse un fichier image en mémoire et renvoie un rapport complet.
 *
 * @param bytes contenu complet du fichier
 * @param declaredMime type annoncé par le client — croisé avec le type réel
 */
export async function validatePanorama(
  bytes: Buffer,
  declaredMime: string | null,
  thresholds: PanoramaThresholds = DEFAULT_PANORAMA_THRESHOLDS,
): Promise<PanoramaReport> {
  const checks: CheckResult[] = []

  const mimeOk = declaredMime !== null && ALLOWED_MIME.has(declaredMime)
  checks.push({
    id: "mime",
    label: "Type de fichier",
    status: mimeOk ? "PASS" : "FAIL",
    detail: mimeOk
      ? `Type accepté (${declaredMime}).`
      : `Type « ${declaredMime ?? "non renseigné"} » refusé. Formats acceptés : JPEG, PNG, WebP.`,
  })

  const sizeOk = bytes.length <= thresholds.maxBytes
  checks.push({
    id: "size",
    label: "Taille",
    status: sizeOk ? "PASS" : "FAIL",
    detail: sizeOk
      ? `Fichier lisible, ${(bytes.length / 1024 / 1024).toFixed(1)} Mo.`
      : `Fichier trop volumineux : ${(bytes.length / 1024 / 1024).toFixed(1)} Mo (maximum ${(thresholds.maxBytes / 1024 / 1024).toFixed(0)} Mo).`,
    value: bytes.length,
    threshold: thresholds.maxBytes,
  })

  let meta: Metadata
  try {
    meta = await sharp(bytes).metadata()
  } catch (error) {
    checks.push({
      id: "readable",
      label: "Lisibilité",
      status: "FAIL",
      detail: `Fichier illisible comme image : ${error instanceof Error ? error.message : "erreur inconnue"}.`,
    })
    return {
      status: "FAIL",
      checks,
      byteSize: bytes.length,
      summary: "Photo 360° refusée : le fichier n'est pas une image lisible.",
    }
  }

  checks.push({ id: "readable", label: "Lisibilité", status: "PASS", detail: `Image décodable (${meta.format}).` })

  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const ratio = height > 0 ? width / height : 0

  const ratioOk = Math.abs(ratio - 2) / 2 <= thresholds.ratioTolerance
  checks.push({
    id: "ratio",
    label: "Ratio panoramique 2:1",
    status: ratioOk ? "PASS" : "FAIL",
    detail: ratioOk
      ? `Ratio conforme : ${ratio.toFixed(2)}:1.`
      : `Ratio incorrect : ${ratio.toFixed(2)}:1. Une photo 360° doit être en 2:1 exactement (largeur = 2 × hauteur).`,
    value: Number(ratio.toFixed(3)),
    threshold: 2,
  })

  const resOk = width >= thresholds.minWidth && height >= thresholds.minHeight
  checks.push({
    id: "resolution",
    label: "Résolution",
    status: resOk ? "PASS" : "FAIL",
    detail: resOk
      ? `Résolution suffisante : ${width}×${height}.`
      : `Résolution insuffisante : ${width}×${height}. Minimum ${thresholds.minWidth}×${thresholds.minHeight} pour un zoom correct.`,
  })

  // Mesures formelles : inutile de décoder les pixels si un seul échoue déjà.
  if (!mimeOk || !sizeOk || !ratioOk || !resOk) {
    return {
      status: "FAIL",
      checks,
      width,
      height,
      ratio: Number(ratio.toFixed(3)),
      byteSize: bytes.length,
      format: meta.format,
      summary: summarize(checks),
    }
  }

  const scale = Math.min(1, 1024 / width)
  const w = Math.max(8, Math.round(width * scale))
  const h = Math.max(4, Math.round(height * scale))
  const { data } = await sharp(bytes)
    .resize(w, h, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  checks.push(...pixelChecks(data, w, h, thresholds))

  return {
    status: verdict(checks),
    checks,
    width,
    height,
    ratio: Number(ratio.toFixed(3)),
    byteSize: bytes.length,
    format: meta.format,
    summary: summarize(checks),
  }
}
