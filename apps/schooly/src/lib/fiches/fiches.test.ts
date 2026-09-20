import { describe, expect, it } from "vitest"

import {
  allowedCyclesFor,
  compareClassNames,
  duplicateClassSupplies,
  isCoherent,
  listSupplyClassNames,
  mergeKitPreset,
  parseClassSupplies,
  parseCyclesOffered,
  parseFeesStructure,
  parseOptionalServices,
  parseSchoolSupplies,
  publishedSupplyClassNames,
  resolveInstallmentDueDates,
  totalInstallments,
} from "./normalize"
import type {
  ClassSuppliesConfiguration,
  SchoolSuppliesByClass,
  SupplyKitPreset,
} from "./types"

// ============================================================================
// Offre académique — schools.cycles_offered
// ============================================================================

describe("parseCyclesOffered — offre académique", () => {
  it("JSONB vide (défaut de colonne) : nature lycee, aucun cycle", () => {
    const result = parseCyclesOffered({})
    expect(result.nature).toBe("lycee")
    expect(result.cycles).toEqual([])
  })

  it("valeur non-objet (null, chaîne) : repli neutre sans throw", () => {
    expect(parseCyclesOffered(null).cycles).toEqual([])
    expect(parseCyclesOffered("general").nature).toBe("lycee")
    expect(parseCyclesOffered(undefined).cycles).toEqual([])
  })

  it("nature inconnue : repli sur « lycee »", () => {
    expect(parseCyclesOffered({ nature: "maternelle" }).nature).toBe("lycee")
  })

  it("accepte les séries en tableau ET en chaîne séparée par des espaces", () => {
    const result = parseCyclesOffered({
      nature: "lycee",
      cycles: [
        {
          key: "general",
          levels: [
            { grade_level_name: "Terminale", level: 7, series: ["C", "D"] },
            { grade_level_name: "Première", level: 6, series: "A C D" },
          ],
        },
      ],
    })
    expect(result.cycles[0].levels[0].series).toEqual(["C", "D"])
    expect(result.cycles[0].levels[1].series).toEqual(["A", "C", "D"])
  })

  it("écarte les doublons et les séries vides", () => {
    const result = parseCyclesOffered({
      cycles: [
        {
          key: "general",
          levels: [{ grade_level_name: "3ᵉ", series: "C C  D , " }],
        },
      ],
    })
    expect(result.cycles[0].levels[0].series).toEqual(["C", "D"])
  })

  it("rejette un niveau sans nom : il serait introuvable au sélecteur parent", () => {
    const result = parseCyclesOffered({
      cycles: [
        {
          key: "general",
          levels: [{ level: 3 }, { grade_level_name: "   ", level: 4 }, { grade_level_name: "5ᵉ" }],
        },
      ],
    })
    expect(result.cycles[0].levels.map((l) => l.grade_level_name)).toEqual(["5ᵉ"])
  })

  it("écarte un cycle sans niveau (pas de badge vide dans la fiche publique)", () => {
    const result = parseCyclesOffered({
      cycles: [{ key: "general", levels: [] }, { key: "professionnel", levels: [{ grade_level_name: "CAP" }] }],
    })
    expect(result.cycles).toHaveLength(1)
    expect(result.cycles[0].key).toBe("professionnel")
  })

  it("un cycle sans libellé reçoit le libellé officiel du cycle", () => {
    const result = parseCyclesOffered({
      cycles: [{ key: "technique", levels: [{ grade_level_name: "1ère F1" }] }],
    })
    expect(result.cycles[0].label).toBe("Enseignement Technique")
  })

  it("diplôme absent : « aucun » plutôt qu'une chaîne vide", () => {
    const result = parseCyclesOffered({
      cycles: [{ key: "general", levels: [{ grade_level_name: "6ᵉ" }] }],
    })
    expect(result.cycles[0].levels[0].diploma).toBe("aucun")
  })
})

describe("allowedCyclesFor / isCoherent — logique conditionnelle du wizard", () => {
  it("table de vérité par nature d'établissement", () => {
    expect(allowedCyclesFor("primaire")).toEqual([])
    expect(allowedCyclesFor("college")).toEqual(["general"])
    expect(allowedCyclesFor("lycee")).toEqual(["general", "technique"])
    expect(allowedCyclesFor("professionnel")).toEqual(["technique", "professionnel"])
    expect(allowedCyclesFor("islamique")).toEqual(["general"])
    expect(allowedCyclesFor("superieur")).toEqual([
      "general",
      "technique",
      "professionnel",
    ])
  })

  it("un collège déclarant une filière professionnelle est incohérent", () => {
    const offered = parseCyclesOffered({
      nature: "college",
      cycles: [{ key: "professionnel", levels: [{ grade_level_name: "CAP" }] }],
    })
    expect(isCoherent(offered)).toBe(false)
  })

  it("un lycée déclarant général + technique reste cohérent", () => {
    const offered = parseCyclesOffered({
      nature: "lycee",
      cycles: [
        { key: "general", levels: [{ grade_level_name: "2nde" }] },
        { key: "technique", levels: [{ grade_level_name: "1ère F1" }] },
      ],
    })
    expect(isCoherent(offered)).toBe(true)
  })

  it("offre vide : cohérente (école pas encore renseignée)", () => {
    expect(isCoherent(parseCyclesOffered({ nature: "college" }))).toBe(true)
  })
})


// ============================================================================
// Tarification — schools.fees_structure
// ============================================================================

describe("parseFeesStructure — droits d'inscription et échéancier", () => {
  it("JSONB vide : devise XOF par défaut, échéancier vide", () => {
    const result = parseFeesStructure({})
    expect(result.currency).toBe("XOF")
    expect(result.installments).toEqual([])
    expect(result.registration_fee).toBeUndefined()
    expect(result.academic_fee).toBeUndefined()
  })

  it("un poste à 0 F sans libellé est une case vide du wizard, pas un tarif", () => {
    const result = parseFeesStructure({
      registration_fee: { amount: 0 },
      academic_fee: { amount: 125000 },
    })
    expect(result.registration_fee).toBeUndefined()
    expect(result.academic_fee?.amount).toBe(125000)
  })

  it("les montants saisis avec séparateurs deviennent des entiers FCFA", () => {
    const result = parseFeesStructure({
      academic_fee: { amount: "125 000" },
      registration_fee: { amount: "5,000" },
    })
    expect(result.academic_fee?.amount).toBe(125000)
    expect(result.registration_fee?.amount).toBe(5000)
  })

  it("montant négatif ou non numérique : neutralisé à 0", () => {
    const result = parseFeesStructure({
      academic_fee: { amount: -5000, label: "Scolarité" },
      registration_fee: { amount: "abc", label: "Inscription" },
    })
    expect(result.academic_fee?.amount).toBe(0)
    expect(result.registration_fee?.amount).toBe(0)
  })

  it("statut par défaut : non_affecte ; statut inconnu replié", () => {
    const result = parseFeesStructure({
      academic_fee: { amount: 1000 },
      registration_fee: { amount: 1000, status: "boursier" },
    })
    expect(result.academic_fee?.status).toBe("non_affecte")
    expect(result.registration_fee?.status).toBe("non_affecte")
  })

  it("audience par défaut : all", () => {
    const result = parseFeesStructure({ academic_fee: { amount: 1000 } })
    expect(result.academic_fee?.applies_to).toBe("all")
  })

  it("tranches triées par position PUIS renumérotées 1..n (trous du wizard)", () => {
    const result = parseFeesStructure({
      installments: [
        { label: "Trimestre 3", position: 7, amount: 40000 },
        { label: "Inscription", position: 1, amount: 5000 },
        { label: "Trimestre 2", position: 3, amount: 40000 },
      ],
    })
    expect(result.installments.map((i) => i.label)).toEqual([
      "Inscription",
      "Trimestre 2",
      "Trimestre 3",
    ])
    expect(result.installments.map((i) => i.position)).toEqual([1, 2, 3])
  })

  it("position absente ou 0 : repli sur 1 (jamais de rang 0 affiché)", () => {
    const result = parseFeesStructure({
      installments: [{ label: "Tranche A", amount: 1000 }],
    })
    expect(result.installments[0].position).toBe(1)
  })

  it("une tranche sans libellé ET sans montant est écartée", () => {
    const result = parseFeesStructure({
      installments: [
        { label: "", amount: 0 },
        { label: "Tranche 1", amount: 40000 },
      ],
    })
    expect(result.installments).toHaveLength(1)
    expect(result.installments[0].label).toBe("Tranche 1")
  })

  it("tranche avec montant mais sans libellé : libellé générique « Tranche »", () => {
    const result = parseFeesStructure({
      installments: [{ amount: 40000 }],
    })
    expect(result.installments[0].label).toBe("Tranche")
  })

  it("date non ISO rejetée → null (calculée à l'exécution)", () => {
    const result = parseFeesStructure({
      installments: [
        { label: "T1", amount: 1000, due_date: "15/09/2024" },
        { label: "T2", amount: 1000, due_date: "2024-02-30" },
        { label: "T3", amount: 1000, due_date: "2024-12-15" },
      ],
    })
    expect(result.installments[0].due_date).toBeNull()
    expect(result.installments[1].due_date).toBeNull()
    expect(result.installments[2].due_date).toBe("2024-12-15")
  })

  it("notes vides : clé absente plutôt que chaîne vide", () => {
    expect(parseFeesStructure({ notes: "   " }).notes).toBeUndefined()
    expect(parseFeesStructure({ notes: "Payable en 3 fois" }).notes).toBe(
      "Payable en 3 fois",
    )
  })

  it("devise personnalisée conservée", () => {
    expect(parseFeesStructure({ currency: "EUR" }).currency).toBe("EUR")
  })
})
// ============================================================================
// Services optionnels — schools.optional_services (Zéro-Image : icônes + badges)
// ============================================================================

describe("parseOptionalServices — services optionnels", () => {
  it("JSONB vide : trois services désactivés avec icônes par défaut", () => {
    const result = parseOptionalServices({})
    expect(result.transport).toMatchObject({ enabled: false, type: "none", vehicle_icon: "bus" })
    expect(result.cantine).toMatchObject({ enabled: false, type: "none", meal_icon: "utensils" })
    expect(result.tenues).toMatchObject({ enabled: false, type: "none", badge_color: "slate" })
  })

  it("zones et régimes incomplets écartés ; prix normalisés", () => {
    const result = parseOptionalServices({
      transport: {
        enabled: true,
        type: "zone",
        zones: [
          { name: "Zone A", price: 15000, frequency: "mensuel" },
          { name: "   " , price: 9000 },
          { price: 9000 },
        ],
      },
      cantine: {
        enabled: true,
        type: "regime",
        regimes: [{ name: "Standard", price: "35 000", frequency: "mensuel" }],
      },
    })
    expect(result.transport.zones).toHaveLength(1)
    expect(result.transport.zones[0]).toMatchObject({ name: "Zone A", price: 15000 })
    expect(result.cantine.regimes[0].price).toBe(35000)
  })

  it("types inconnus repliés sur « none » ; icône tenue par défaut « shirt »", () => {
    const result = parseOptionalServices({
      transport: { enabled: true, type: "avion" },
      tenues: {
        enabled: true,
        type: "uniforme",
        items: [{ name: "Tenue de jour", price: 8500 }],
      },
    })
    expect(result.transport.type).toBe("none")
    expect(result.tenues.type).toBe("none")
    expect(result.tenues.items[0]).toMatchObject({ icon: "shirt", color: "slate" })
  })
})
