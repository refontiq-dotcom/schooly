import { describe, expect, it } from "vitest"
import {
  ACCEPTED_FORMATS_LABEL,
  MAX_BYTES_LABEL,
  PANORAMA_MAX_BYTES,
  PANORAMA_MIN_HEIGHT,
  PANORAMA_MIN_WIDTH,
  describeRejection,
  humanizeApiError,
  precheckDimensions,
  precheckFileHeader,
  rejectionFromReport,
  type PanoramaReport,
} from "./panorama-upload"

describe("precheckFileHeader", () => {
  it("accepte un JPEG dans la limite", () => {
    expect(precheckFileHeader({ type: "image/jpeg", size: 4 * 1024 * 1024 })).toBeNull()
  })

  it("accepte PNG et WebP", () => {
    expect(precheckFileHeader({ type: "image/png", size: 1024 })).toBeNull()
    expect(precheckFileHeader({ type: "image/webp", size: 1024 })).toBeNull()
  })

  it("refuse un format hors nomenclature serveur", () => {
    const result = precheckFileHeader({ type: "image/gif", size: 1024 })
    expect(result?.blocking).toBe(true)
    expect(result?.message).toContain(ACCEPTED_FORMATS_LABEL)
  })

  it("refuse un fichier vide", () => {
    expect(precheckFileHeader({ type: "image/jpeg", size: 0 })?.blocking).toBe(true)
  })

  it("refuse un fichier dépassant la limite backend", () => {
    const result = precheckFileHeader({ type: "image/jpeg", size: PANORAMA_MAX_BYTES + 1 })
    expect(result?.blocking).toBe(true)
    expect(result?.message).toContain(MAX_BYTES_LABEL)
  })

  it("accepte exactement la limite backend", () => {
    expect(precheckFileHeader({ type: "image/jpeg", size: PANORAMA_MAX_BYTES })).toBeNull()
  })
})

describe("precheckDimensions", () => {
  it("accepte un 2:1 conforme", () => {
    expect(precheckDimensions(6000, 3000)).toBeNull()
  })

  it("refuse une photo 4:3", () => {
    const result = precheckDimensions(4000, 3000)
    expect(result?.blocking).toBe(true)
    expect(result?.message).toContain("Ratio incorrect")
  })

  it("refuse un 2:1 trop petit", () => {
    const result = precheckDimensions(1024, 512)
    expect(result?.blocking).toBe(true)
    expect(result?.message).toContain(`${PANORAMA_MIN_WIDTH}×${PANORAMA_MIN_HEIGHT}`)
  })

  it("ne bloque pas quand la mesure est impossible", () => {
    expect(precheckDimensions(0, 0)).toBeNull()
    expect(precheckDimensions(Number.NaN, 300)).toBeNull()
  })

  it("ne prétend jamais qualifier l'image de vraie photo 360°", () => {
    const message = precheckDimensions(6000, 3000)?.message ?? ""
    expect(message).not.toMatch(/vraie photo 360|est bien un panorama/i)
  })
})

describe("rejectionFromReport", () => {
  const report = (checks: PanoramaReport["checks"]): PanoramaReport => ({
    status: "FAIL",
    checks,
    summary: "s",
  })

  it("retrouve le motif du premier contrôle en échec", () => {
    const found = rejectionFromReport(
      report([{ id: "ratio", status: "FAIL", detail: "Ratio incorrect : 1.33:1." }]),
    )
    expect(found).toEqual({ code: "invalid_ratio", details: "Ratio incorrect : 1.33:1." })
  })

  it("remonte le raccord non conforme", () => {
    const found = rejectionFromReport(
      report([{ id: "seam", status: "FAIL", detail: "Raccord visible : discontinuité 3.10×." }]),
    )
    expect(found?.code).toBe("torn_seam")
  })

  it("ignore les contrôles en avertissement", () => {
    expect(rejectionFromReport(report([{ id: "seam", status: "WARNING", detail: "léger flou" }]))).toBeNull()
  })

  it("reste nul sans rapport", () => {
    expect(rejectionFromReport(null)).toBeNull()
  })
})

describe("describeRejection", () => {
  it("traduit chaque motif connu", () => {
    for (const code of ["invalid_mime", "unreadable_file", "too_large", "invalid_ratio", "invalid_resolution", "torn_seam", "black_zones"]) {
      const result = describeRejection(code, null)
      expect(result.headline).not.toBe("Visite 360° refusée")
      expect(result.action.length).toBeGreaterThan(10)
    }
  })

  it("conserve le détail du serveur quand il existe", () => {
    expect(describeRejection("torn_seam", "Raccord visible.").detail).toBe("Raccord visible.")
  })

  it("retombe sur un message lisible pour un motif inconnu", () => {
    const result = describeRejection("code_inconnu", null)
    expect(result.headline).toBe("Visite 360° refusée")
    expect(result.detail).toBeNull()
  })
})

describe("humanizeApiError", () => {
  it("traduit une coupure réseau", () => {
    expect(humanizeApiError(0, null)).toMatch(/Connexion interrompue/)
  })

  it("reprend un message serveur déjà écrit en clair", () => {
    expect(humanizeApiError(400, "Format accepté : JPG, PNG ou WebP")).toBe("Format accepté : JPG, PNG ou WebP")
  })

  it("traduit un conflit de publication", () => {
    expect(humanizeApiError(409, null)).toMatch(/pas publiable/)
  })

  it("traduit un stockage indisponible", () => {
    expect(humanizeApiError(503, null)).toMatch(/momentanément indisponible/)
  })

  it("traduit une erreur serveur sans message technique", () => {
    const message = humanizeApiError(500, "Erreur validation")
    expect(message).toMatch(/Erreur temporaire/)
    expect(message).not.toContain("Erreur validation")
  })

  it("ne renvoie jamais de message vide", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
      expect(humanizeApiError(status, null).length).toBeGreaterThan(0)
    }
  })
})
