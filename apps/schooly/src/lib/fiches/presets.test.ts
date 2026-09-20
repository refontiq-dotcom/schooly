// ============================================================================
// M7 — Tests « Fournitures & Kits préréglés » (complément à fiches.test.ts).
// Invariants structurels des 5 kits nationaux (presets.ts) + non-régression
// de la fusion mergeKitPreset (M1) avec les données réelles des kits.
// ============================================================================

import { describe, expect, it } from "vitest"
import {
  EDUCATION_CYCLES,
  type ClassSuppliesConfiguration,
  type SupplyKitPreset,
} from "./types"
import { SUPPLY_KIT_PRESETS, presetsForCycle } from "./presets"
import { mergeKitPreset } from "./normalize"

function emptyConfig(): ClassSuppliesConfiguration {
  return {
    status: "draft",
    class_label: "6e",
    level: 1,
    cycle: "general",
    year: "2026-2027",
    manuals: [],
    stationery: [],
    equipment: [],
  }
}

describe("SUPPLY_KIT_PRESETS — invariants structurels", () => {
  it("expose des ids uniques et des champs descriptifs non vides", () => {
    const ids = SUPPLY_KIT_PRESETS.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const kit of SUPPLY_KIT_PRESETS) {
      expect(kit.id.trim()).not.toBe("")
      expect(kit.label.trim()).not.toBe("")
      expect(kit.description?.trim() ?? "").not.toBe("")
    }
  })

  it("cible uniquement des cycles connus et des niveaux entiers ≥ 1", () => {
    for (const kit of SUPPLY_KIT_PRESETS) {
      expect(EDUCATION_CYCLES).toContain(kit.cycle)
      expect(kit.levels.length).toBeGreaterThan(0)
      for (const level of kit.levels) {
        expect(Number.isInteger(level)).toBe(true)
        expect(level).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it("respecte le contrat Zero-Image de chaque item (icône, jamais de photo)", () => {
    for (const kit of SUPPLY_KIT_PRESETS as SupplyKitPreset[]) {
      for (const manual of kit.manuals) {
        expect(manual.subject.trim()).not.toBe("")
        expect(manual.title.trim()).not.toBe("")
        expect(manual.editor.trim()).not.toBe("")
        expect(manual.icon.trim()).not.toBe("")
        expect(typeof manual.required_for_inscription).toBe("boolean")
      }
      for (const item of kit.stationery) {
        expect(item.category.trim()).not.toBe("")
        expect(item.name.trim()).not.toBe("")
        expect(item.quantity.trim()).not.toBe("")
        expect(item.icon.trim()).not.toBe("")
      }
      for (const item of kit.equipment) {
        expect(item.name.trim()).not.toBe("")
        expect(item.quantity.trim()).not.toBe("")
        expect(item.icon.trim()).not.toBe("")
        expect(typeof item.required_for_inscription).toBe("boolean")
      }
    }
  })

  it("couvre les trois cycles d'enseignement", () => {
    for (const cycle of EDUCATION_CYCLES) {
      expect(presetsForCycle(cycle).length).toBeGreaterThan(0)
    }
  })
})

describe("presetsForCycle — filtrage par cycle", () => {
  it("renvoie 3 kits généraux, 1 technique, 1 professionnel", () => {
    expect(presetsForCycle("general").map((k) => k.id)).toEqual([
      "general-6e",
      "general-3e",
      "general-tle",
    ])
    expect(presetsForCycle("technique").map((k) => k.id)).toEqual([
      "technique-2nde",
    ])
    expect(presetsForCycle("professionnel").map((k) => k.id)).toEqual([
      "pro-cap",
    ])
  })

  it("renvoie un tableau vide pour un cycle inconnu", () => {
    expect(presetsForCycle("inconnu")).toEqual([])
  })
})

describe("mergeKitPreset — fusion non-destructive avec les kits réels", () => {
  const kit6e = SUPPLY_KIT_PRESETS.find((k) => k.id === "general-6e")!
  const kit3e = SUPPLY_KIT_PRESETS.find((k) => k.id === "general-3e")!

  it("ajoute l'intégralité du kit sur une configuration vide", () => {
    const merged = mergeKitPreset(emptyConfig(), kit6e)
    expect(merged.manuals).toHaveLength(kit6e.manuals.length)
    expect(merged.stationery).toHaveLength(kit6e.stationery.length)
    expect(merged.equipment).toHaveLength(kit6e.equipment.length)
  })

  it("conserve l'existant et n'ajoute que les nouveautés (pas de doublon)", () => {
    // NB : les chaînes reprennent EXACTEMENT celles des kits (ASCII, sans
    // accents) : normalizeKey (M1) déduplique sur la clé normalisée
    // minuscules/trim mais ne fold pas les accents en V1.
    const existingManual = {
      subject: "Francais",
      title: "Francais 6e",
      editor: "Programme national",
      icon: "book",
      required_for_inscription: false,
    }
    const existingStationery = {
      category: "Ecriture",
      name: "Cahiers 200 pages",
      quantity: "4",
      icon: "notebook",
    }
    const existingEquipment = {
      name: "Rame de papier A4",
      quantity: "1",
      required_for_inscription: true,
      icon: "package",
    }
    const config: ClassSuppliesConfiguration = {
      ...emptyConfig(),
      manuals: [existingManual],
      stationery: [existingStationery],
      equipment: [existingEquipment],
    }

    const merged = mergeKitPreset(config, kit6e)
    // L'objet existant est conservé tel quel (même référence).
    expect(merged.manuals[0]).toBe(existingManual)
    expect(merged.stationery[0]).toBe(existingStationery)
    expect(merged.equipment[0]).toBe(existingEquipment)
    // Seules les nouveautés du kit sont ajoutées.
    expect(merged.manuals).toHaveLength(kit6e.manuals.length)
    expect(merged.stationery).toHaveLength(kit6e.stationery.length)
    expect(merged.equipment).toHaveLength(kit6e.equipment.length)
  })

  it("l'union de deux kits successifs ne produit aucun doublon", () => {
    const once = mergeKitPreset(emptyConfig(), kit3e)
    const twice = mergeKitPreset(once, kit3e)
    expect(twice.manuals).toHaveLength(once.manuals.length)
    expect(twice.stationery).toHaveLength(once.stationery.length)
    expect(twice.equipment).toHaveLength(once.equipment.length)
  })
})