/**
 * Tests du contrôle qualité 360°.
 *
 * ⚠️ FIXTURES SYNTHÉTIQUES — ce ne sont PAS de vraies photos 360° d'une pièce.
 * Ce sont des images construites par calcul, uniquement pour exercer un chemin
 * précis du validateur (raccord rompu, ratio faux, trous noirs, etc.). Elles
 * ne sont pas une visite virtuelle et ne doivent jamais servir de référence
 * éditoriale. Une véritable photo 360° viendra d'une capture réelle.
 */
import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { DEFAULT_PANORAMA_THRESHOLDS, validatePanorama, type PanoramaThresholds } from "./panorama-validator"

const W = 512
const H = 256

/**
 * Panoramique de test dont le signal est périodique : le bord gauche et le bord
 * droit sont mathématiquement voisins, donc le raccord doit être mesuré continu.
 *
 * Les composantes à haute fréquence ne sont pas décoratives : sans détail fin,
 * le contrôle de netteté signale à juste titre une image molle, et la fixture
 * ne ressemblerait à rien de réel. Une vraie photo porte du détail partout.
 */
function seamlessPanorama(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = sample(x, y, width, height, 0)
    }
  }
  return data
}

/** Même image, mais la fin est décalée : le raccord de bouclage saute. */
function tornSeamPanorama(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height)
  const jumpFrom = width - Math.floor(width * 0.01)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = sample(x, y, width, height, x >= jumpFrom ? 120 : 0)
    }
  }
  return data
}

/** Image 2:1 dont le bas est noir : trou / nadir manquant. */
function blackBandPanorama(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = y > height * 0.7 ? 0 : sample(x, y, width, height, 0)
    }
  }
  return data
}

/**
 * Pixel de la fixture. Toutes les composantes en x sont périodiques (période
 * entière sur la largeur) : c'est ce qui rend le bouclage continu, et c'est la
 * seule propriété qui distingue un vrai panorama d'une simple image large.
 * Les amplitudes sont volontairement bornées pour que la somme reste dans
 * [35, 245] : une fixture qui sature à 0 fabriquerait de fausses zones noires,
 * et le contrôle « zones noires » la refuserait à juste titre.
 */
function sample(x: number, y: number, width: number, height: number, jump: number): number {
  const base =
    30 * Math.sin((2 * Math.PI * x) / width) +
    25 * Math.sin((2 * Math.PI * 8 * x) / width) +
    30 * Math.sin((2 * Math.PI * 4 * y) / height) +
    25 * Math.sin((2 * Math.PI * 32 * y) / height)
  return Math.max(0, Math.min(255, Math.round(140 + base + jump)))
}

async function png(data: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer()
}

/** Seuils relâchés : la validation ne redimensionne pas, les mesures sont exactes. */
const TEST_THRESHOLDS: PanoramaThresholds = {
  ...DEFAULT_PANORAMA_THRESHOLDS,
  minWidth: W,
  minHeight: H,
}

const find = (report: Awaited<ReturnType<typeof validatePanorama>>, id: string) =>
  report.checks.find((c) => c.id === id)

describe("validatePanorama — contrôles formels", () => {
  it("accepte un panorama 2:1 bien formé", async () => {
    const bytes = await png(seamlessPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    expect(report.status).toBe("PASS")
    expect(find(report, "ratio")?.status).toBe("PASS")
    expect(find(report, "resolution")?.status).toBe("PASS")
    expect(find(report, "readable")?.status).toBe("PASS")
  })

  it("refuse un ratio qui n'est pas 2:1, et l'annonce précisément", async () => {
    // 4:3 — c'est le cas d'une photo normale envoyée par erreur.
    const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#808080" } })
      .png()
      .toBuffer()
    const report = await validatePanorama(bytes, "image/png", { ...TEST_THRESHOLDS, minWidth: 100, minHeight: 100 })
    expect(report.status).toBe("FAIL")
    expect(find(report, "ratio")?.status).toBe("FAIL")
    expect(report.summary).toContain("1.33:1")
    expect(report.summary).toContain("2:1")
  })

  it("refuse une résolution insuffisante", async () => {
    const bytes = await png(seamlessPanorama(64, 32), 64, 32)
    const report = await validatePanorama(bytes, "image/png", { ...TEST_THRESHOLDS, minWidth: 1024, minHeight: 512 })
    expect(find(report, "resolution")?.status).toBe("FAIL")
    expect(report.summary.toLowerCase()).toContain("résolution insuffisante")
  })

  it("refuse un type MIME hors allowlist — le vecteur SVG", async () => {
    const bytes = await png(seamlessPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/svg+xml", TEST_THRESHOLDS)
    expect(report.status).toBe("FAIL")
    expect(find(report, "mime")?.status).toBe("FAIL")
  })

  it("refuse un fichier qui n'est pas une image", async () => {
    const report = await validatePanorama(Buffer.from("ceci n'est pas une image"), "image/png", TEST_THRESHOLDS)
    expect(report.status).toBe("FAIL")
    expect(find(report, "readable")?.status).toBe("FAIL")
    expect(report.summary).toContain("pas une image lisible")
  })

describe("validatePanorama — mesures sur pixels", () => {
  it("valide un raccord continu", async () => {
    const bytes = await png(seamlessPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    const seam = find(report, "seam")
    expect(seam?.status).toBe("PASS")
    // Le raccord doit rester comparable au bruit de l'image, pas le dépasser.
    expect(seam?.value ?? 99).toBeLessThan(DEFAULT_PANORAMA_THRESHOLDS.seamRatioLimit)
  })

  it("refuse un raccord rompu entre le bord droit et le bord gauche", async () => {
    // C'est LE contrôle propre au panorama : il est cyclique, donc sa
    // fermeture doit être aussi continue que l'intérieur.
    const bytes = await png(tornSeamPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    const seam = find(report, "seam")
    expect(seam?.status).toBe("FAIL")
    expect(seam?.detail).toContain("Raccord visible")
    expect(report.summary).toContain("assemblée")
  })

  it("refuse une image percée de zones noires", async () => {
    const bytes = await png(blackBandPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    const black = find(report, "black")
    expect(black?.status).toBe("FAIL")
    expect(black?.detail).toContain("trous")
  })

  it("signale une sous-exposition sans refuser l'image", async () => {
    // Panoramique sombre mais techniquement conforme : WARNING, pas FAIL.
    const dark = Buffer.alloc(W * H)
    for (let i = 0; i < dark.length; i++) dark[i] = 12 + (i % 7)
    const bytes = await png(dark, W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    expect(find(report, "exposure")?.status).toBe("WARNING")
    expect(report.status).not.toBe("FAIL")
  })

  it("produit un rapport lisible par un directeur d établissement", async () => {
    const bytes = await png(seamlessPanorama(W, H), W, H)
    const report = await validatePanorama(bytes, "image/png", TEST_THRESHOLDS)
    expect(report.summary).toContain("acceptée")
    for (const check of report.checks) {
      expect(["PASS", "WARNING", "FAIL"]).toContain(check.status)
      expect(check.label.length).toBeGreaterThan(3)
      expect(check.detail.length).toBeGreaterThan(5)
    }
  })
})

})