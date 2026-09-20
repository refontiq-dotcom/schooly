// ============================================================================
// M7 — Test RUNTIME du PDF Mode B : génération réelle via @react-pdf/renderer
// + qrcode. Vérifie que renderModeB produit un buffer PDF valide (magic
// bytes « %PDF- »), non trivial, et que le QR code est un PNG data URL.
// Complète les tests unitaires (structure) par un test d'intégration.
// ============================================================================

import { describe, expect, it } from "vitest"
import QRCode from "qrcode"
import { renderModeB, type ModeBData } from "./mode-b-document"

function baseData(qrDataUrl: string, qrTargetUrl: string): ModeBData {
  return {
    schoolName: "Collège Moderne Test",
    city: "Abidjan",
    address: "Cocody Riviera 3",
    phone: "+225 07 00 00 00 00",
    email: "contact@college-test.ci",
    cycles: {
      nature: "college",
      cycles: [
        {
          key: "general",
          series: ["A", "C", "D"],
          levels: [
            {
              grade_level_name: "6ème",
              level: 1,
              cycle: "general",
              series: ["A", "C", "D"],
              diploma: "bepc",
              requires_filiere_choice: false,
            },
            {
              grade_level_name: "3ème",
              level: 3,
              cycle: "general",
              series: ["A", "C", "D"],
              diploma: "bepc",
              requires_filiere_choice: false,
            },
          ],
        },
      ],
    },
    fees: {
      registration_fee: {
        amount: 25000,
        is_mandatory: true,
        applies_to: "new_students",
        status: "non_affecte",
        label: "Droits d'inscription",
      },
      academic_fee: {
        amount: 150000,
        is_mandatory: true,
        applies_to: "all",
        status: "non_affecte",
      },
      installments: [
        { label: "Tranche 1", position: 1, amount: 60000, due_date: "2026-10-01", status: "non_affecte" },
        { label: "Tranche 2", position: 2, amount: 45000, due_date: "2027-01-10", status: "non_affecte" },
        { label: "Tranche 3", position: 3, amount: 45000, due_date: null, status: "non_affecte" },
      ],
      currency: "XOF",
      notes: "Frais de transport et de cantine non inclus.",
    },
    services: {
      transport: {
        enabled: true,
        type: "zone",
        zones: [{ name: "Zone A (Cocody)", price: 15000, frequency: "mensuel" }],
        vehicle_icon: "bus",
        frequency: "mensuel",
      },
      cantine: {
        enabled: false,
        type: "none",
        regimes: [],
        meal_icon: "utensils",
        frequency: "mensuel",
      },
      tenues: {
        enabled: true,
        type: "uniform",
        items: [
          {
            name: "Grand uniforme",
            description: "Blouse kaki + pantalon beige",
            icon: "shirt",
            color: "olive",
            price: 12000,
            one_time: true,
          },
        ],
        badge_color: "blue",
      },
    },
    qrDataUrl,
    qrTargetUrl,
    generatedAt: "1 janvier 2026 à 12:00",
  }
}

describe("renderModeB — génération PDF réelle (intégration)", () => {
  it("produit un buffer PDF valide commençant par les magic bytes « %PDF- »", async () => {
    const target = "http://localhost:3001/fiche/11111111-1111-1111-1111-111111111111"
    const qr = await QRCode.toDataURL(target, { margin: 1, width: 240 })
    const pdf = await renderModeB(baseData(qr, target))

    expect(pdf.byteLength).toBeGreaterThan(1000)
    const header = new TextDecoder().decode(pdf.slice(0, 5))
    expect(header).toBe("%PDF-")
  })

  it("rend un PDF même quand la fiche est quasi vide (dégradation propre)", async () => {
    const target = "http://localhost:3001/fiche/test-vide"
    const qr = await QRCode.toDataURL(target)
    const data = baseData(qr, target)
    data.cycles.cycles = []
    data.fees.registration_fee = undefined
    data.fees.academic_fee = undefined
    data.fees.installments = []
    data.services.transport = {
      enabled: false,
      type: "none",
      zones: [],
      vehicle_icon: "bus",
      frequency: "mensuel",
    }
    data.services.tenues = { enabled: false, type: "none", items: [], badge_color: "blue" }
    const pdf = await renderModeB(data)

    expect(pdf.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-")
  })
})

describe("qrcode — génération du QR Mode B", () => {
  it("génère une data URL PNG valide pointant vers la fiche publique", async () => {
    const target = "http://localhost:3001/fiche/abc123"
    const qr = await QRCode.toDataURL(target, { margin: 1, width: 240 })
    expect(qr.startsWith("data:image/png;base64,")).toBe(true)
    // Payload PNG minimal : les data URL base64 d'un QR 240px dépassent 1 Ko.
    expect(qr.length).toBeGreaterThan(1000)
  })
})