import { describe, expect, it } from "vitest"
import {
  findLevelByName,
  normalizePhone,
  pickNextLevel,
  seatsAvailable,
  type GradeLevelRow,
} from "./reinscription"

/**
 * Niveaux d'une école primaire + collège, avec des rangs non contigus pour
 * vérifier que la progression ne dépend pas de la position dans le tableau.
 */
const LEVELS: GradeLevelRow[] = [
  { id: "l1", name: "CP1", level: 1 },
  { id: "l2", name: "CP2", level: 2 },
  { id: "l3", name: "CE1", level: 3 },
  { id: "l4", name: "CE2", level: 4 },
  { id: "l5", name: "CM1", level: 5 },
  { id: "l6", name: "CM2", level: 6 },
  { id: "l7", name: "6ème", level: 10 },
  { id: "l8", name: "5ème", level: 11 },
]

describe("normalizePhone", () => {
  it("normalise un numéro local sans séparateur", () => {
    expect(normalizePhone("0700000000")).toBe("+2250700000000")
  })

  it("normalise un numéro déjà formaté par le formulaire public", () => {
    expect(normalizePhone("+225 07 00 00 00 00")).toBe("+2250700000000")
  })

  it("normalise un numéro international compact", () => {
    expect(normalizePhone("+2250700000000")).toBe("+2250700000000")
  })

  it("normalise le préfixe international « 00225 »", () => {
    expect(normalizePhone("002250700000000")).toBe("+2250700000000")
  })

  it("normalise l'indicatif « 225 » sans « + »", () => {
    expect(normalizePhone("2250700000000")).toBe("+2250700000000")
  })

  it("ignore les tirets et parenthèses", () => {
    expect(normalizePhone("07-00-00-00-00")).toBe("+2250700000000")
    expect(normalizePhone("(225) 07 00 00 00 00")).toBe("+2250700000000")
  })

  it("est idempotente : un numéro déjà normalisé reste inchangé", () => {
    const once = normalizePhone("07 00 00 00 00")
    expect(normalizePhone(once)).toBe(once)
  })

  it("ne retire pas « 225 » d'un numéro local de 10 chiffres commençant par 225", () => {
    // 10 chiffres exactement ⇒ c'est un numéro local, pas un indicatif.
    expect(normalizePhone("2250000000")).toBe("+2252250000000")
  })

  it("retourne null si aucun chiffre", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone("abc")).toBeNull()
    expect(normalizePhone("   ")).toBeNull()
  })

  it("retourne null pour une entrée absente", () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe("seatsAvailable", () => {
  it("soustrait les inscrits de la capacité", () => {
    expect(seatsAvailable(40, 12)).toBe(28)
  })

  it("ne descend jamais sous zéro (sur-effectif)", () => {
    expect(seatsAvailable(30, 35)).toBe(0)
  })

  it("traite une capacité absente comme zéro", () => {
    expect(seatsAvailable(null, 0)).toBe(0)
    expect(seatsAvailable(undefined, 3)).toBe(0)
  })
})

describe("findLevelByName", () => {
  it("trouve par correspondance exacte", () => {
    expect(findLevelByName("CM2", LEVELS)?.id).toBe("l6")
  })

  it("ignore la casse et les accents", () => {
    expect(findLevelByName("6EME", LEVELS)?.id).toBe("l7")
    expect(findLevelByName("6ème", LEVELS)?.id).toBe("l7")
  })

  it("absorbe un libellé composite par préfixe (classe « 6ème A »)", () => {
    expect(findLevelByName("6ème A", LEVELS)?.id).toBe("l7")
  })

  it("préfère la correspondance la plus longue", () => {
    const levels: GradeLevelRow[] = [
      { id: "a", name: "6", level: 1 },
      { id: "b", name: "6ème", level: 2 },
    ]
    expect(findLevelByName("6ème B", levels)?.id).toBe("b")
  })

  it("retourne null pour un libellé inconnu ou absent", () => {
    expect(findLevelByName("Terminale", LEVELS)).toBeNull()
    expect(findLevelByName("", LEVELS)).toBeNull()
    expect(findLevelByName(null, LEVELS)).toBeNull()
  })
})

describe("pickNextLevel", () => {
  it("promeut au rang immédiatement supérieur", () => {
    expect(pickNextLevel("CE1", LEVELS)?.name).toBe("CE2")
  })

  it("franchit un trou de numérotation (CM2 → 6ème, rang 6 → 10)", () => {
    expect(pickNextLevel("CM2", LEVELS)?.name).toBe("6ème")
  })

  it("accepte un libellé de classe composite", () => {
    expect(pickNextLevel("CM2 A", LEVELS)?.name).toBe("6ème")
  })

  it("ne dépend pas de l'ordre du tableau fourni", () => {
    const shuffled = [...LEVELS].reverse()
    expect(pickNextLevel("CM2", shuffled)?.name).toBe("6ème")
  })

  it("retourne null au dernier niveau de l'école (fin de cycle)", () => {
    expect(pickNextLevel("5ème", LEVELS)).toBeNull()
  })

  it("retourne null si le niveau actuel est inconnu du référentiel", () => {
    expect(pickNextLevel("Terminale", LEVELS)).toBeNull()
    expect(pickNextLevel(null, LEVELS)).toBeNull()
  })

  it("retourne null si l'école n'a aucun niveau", () => {
    expect(pickNextLevel("CM2", [])).toBeNull()
  })
})
