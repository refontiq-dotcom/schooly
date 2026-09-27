/**
 * Tests du cycle de vie d'une visite 360° et du contrat Trouvetou.
 *
 * ⚠️ Aucun média réel ici : ces tests n'exercent que des transitions et des
 * règles de décision, à partir de rapports de validation simulés. Le contrôle
 * sur pixels lui-même est couvert par panorama-validator.test.ts, et l'écriture
 * réelle dans R2 par r2.integration.test.ts.
 */
import { describe, expect, it } from "vitest"
import {
  canPublish,
  canTransition,
  decideFromReport,
  isPublishable,
  toTrouvetouMediaContract,
} from "./panorama-state"

const VALIDATED = { status: "PASS", checks: [{ id: "ratio", status: "PASS", detail: "Ratio conforme." }] }

const report = (status: string, checks: { id: string; status: string; detail: string }[]) => ({ status, checks })

describe("decideFromReport — décision de validation", () => {
  it("accepte un rapport entièrement conforme", () => {
    const decision = decideFromReport(VALIDATED)
    expect(decision.status).toBe("validated")
    expect(decision.rejectionCode).toBeNull()
  })

  it("accepte malgré un WARNING : un conseil n'est pas un refus", () => {
    // Netteté et exposition ne donnent que WARNING ; bloquer la publication sur
    // un simple conseil rendrait le contrôle inutilisable en production.
    const decision = decideFromReport(
      report("WARNING", [{ id: "sharpness", status: "WARNING", detail: "Image peu contrastée." }]),
    )
    expect(decision.status).toBe("validated")
  })

  it.each([
    ["ratio", "invalid_ratio"],
    ["resolution", "invalid_resolution"],
    ["readable", "unreadable_file"],
    ["mime", "invalid_mime"],
    ["seam", "torn_seam"],
    ["black", "black_zones"],
    ["size", "too_large"],
  ] as const)("convertit l'échec %s en motif structuré %s", (checkId, expectedCode) => {
    const decision = decideFromReport(report("FAIL", [{ id: checkId, status: "FAIL", detail: "détail." }]))
    expect(decision.status).toBe("rejected")
    expect(decision.rejectionCode).toBe(expectedCode)
  })

  it("conserve la raison lisible du refus", () => {
    const decision = decideFromReport(
      report("FAIL", [{ id: "ratio", status: "FAIL", detail: "Ratio incorrect : 1.78:1." }]),
    )
    expect(decision.rejectionDetails).toBe("Ratio incorrect : 1.78:1.")
  })

  it("retient un motif déterministe quand plusieurs contrôles échouent", () => {
    // Un rapport à la fois invalide en ratio ET en résolution doit toujours
    // produire le même motif, sinon le support voit autre chose à chaque fois.
    const a = decideFromReport(
      report("FAIL", [
        { id: "ratio", status: "FAIL", detail: "ratio" },
        { id: "resolution", status: "FAIL", detail: "resolution" },
      ]),
    )
    const b = decideFromReport(
      report("FAIL", [
        { id: "resolution", status: "FAIL", detail: "resolution" },
        { id: "ratio", status: "FAIL", detail: "ratio" },
      ]),
    )
    expect(a.rejectionCode).toBe(b.rejectionCode)
  })
})

describe("machine à états", () => {
  it("suit le chemin nominal uploaded → validated → published", () => {
    expect(canTransition("uploaded", "validated")).toBe(true)
    expect(canTransition("validated", "published")).toBe(true)
  })

  it("permet le rejet depuis uploaded comme depuis validated", () => {
    expect(canTransition("uploaded", "rejected")).toBe(true)
    expect(canTransition("validated", "rejected")).toBe(true)
  })

  it("rend le rejet terminal : rien ne peut suivre", () => {
    expect(canTransition("rejected", "validated")).toBe(false)
    expect(canTransition("rejected", "published")).toBe(false)
    expect(canTransition("rejected", "uploaded")).toBe(false)
  })

  it("interdit de publier un média jamais validé", () => {
    expect(canTransition("uploaded", "published")).toBe(false)
    expect(canPublish("uploaded")).toBe(false)
    expect(canPublish("rejected")).toBe(false)
  })

  it("n'autorise la publication que depuis validated", () => {
    expect(canPublish("validated")).toBe(true)
    expect(canPublish("published")).toBe(false)
  })
})

describe("contrat Trouvetou", () => {
  const published = {
    id: "11111111-1111-1111-1111-111111111111",
    status: "published",
    r2_key: "schooly/production/360/s1/11111111-1111-1111-1111-111111111111.jpg",
    public_url: "https://pub.example.r2.dev/schooly/production/360/s1/11111111-1111-1111-1111-111111111111.jpg",
    width: 6000,
    height: 3000,
    byte_size: 4_200_000,
    content_type: "image/jpeg",
    room_id: null,
    validated_at: "2026-09-28T10:00:00.000Z",
  }

  it("transmet un média publié, avec un marqueur de type exploitable", () => {
    const contract = toTrouvetouMediaContract(published)
    expect(contract).not.toBeNull()
    // Sans ce marqueur, Trouvetou ne peut pas choisir entre image et visionneuse.
    expect(contract?.media_type).toBe("photo_360")
    expect(contract?.projection).toBe("equirectangular_2_1")
    expect(contract?.url).toBe(published.public_url)
    expect(contract?.width).toBe(6000)
  })

  it.each(["uploaded", "validated", "rejected"])("refuse de transmettre un média au statut %s", (status) => {
    // Une photo non publiée ne doit pas devenir une annonce publique, même si
    // le script de synchronisation la rencontre.
    expect(toTrouvetouMediaContract({ ...published, status })).toBeNull()
  })

  it("indique si un média peut partir vers Trouvetou", () => {
    expect(isPublishable("published")).toBe(true)
    expect(isPublishable("validated")).toBe(false)
  })
})