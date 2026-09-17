import { describe, expect, it } from "vitest"
import {
  pickTargetClass,
  resolveRolloverTarget,
  type ClassRef,
  type GradeLevelRef,
} from "./class-assignment"

// ⚠️ Convention de `level` : c'est un RANG CROISSANT (1 = première année de
// l'école, n = dernière), pas un numéro de classe. La promotion vaut donc
// `rang + 1`. Une école qui saisissait « 6ème » = 6 puis « 5ème » = 5 (rangs
// descendants) verrait ses élèves de dernier rang diplômés à tort — d'où
// l'avertissement affiché dans le panneau de bascule.
const LEVELS: GradeLevelRef[] = [
  { id: "lvl-1", level: 1 },
  { id: "lvl-2", level: 2 },
  { id: "lvl-3", level: 3 },
]

const CLASSES: ClassRef[] = [
  { id: "c-1a", name: "6ème A", grade_level_id: "lvl-1" },
  { id: "c-1b", name: "6ème B", grade_level_id: "lvl-1" },
  { id: "c-2a", name: "5ème A", grade_level_id: "lvl-2" },
  { id: "c-2b", name: "5ème B", grade_level_id: "lvl-2" },
]

describe("pickTargetClass — appariement du parallèle", () => {
  it("choisit l'unique classe du niveau, quelle que soit la classe d'origine", () => {
    const single: ClassRef[] = [{ id: "c-2-unique", name: "5ème", grade_level_id: "lvl-2" }]
    expect(pickTargetClass(single, "lvl-2", null)).toBe("c-2-unique")
    expect(pickTargetClass(single, "lvl-2", "c-1b")).toBe("c-2-unique")
  })

  it("suit le parallèle « A » → « A »", () => {
    expect(pickTargetClass(CLASSES, "lvl-2", "c-1a")).toBe("c-2a")
    expect(pickTargetClass(CLASSES, "lvl-2", "c-1b")).toBe("c-2b")
  })

  it("conserve la classe exacte d'un élève qui redouble", () => {
    expect(pickTargetClass(CLASSES, "lvl-1", "c-1b")).toBe("c-1b")
  })

  it("renvoie null si aucun parallèle ne correspond", () => {
    expect(pickTargetClass(CLASSES, "lvl-2", null)).toBeNull()
    const withC: ClassRef[] = [
      ...CLASSES,
      { id: "c-1c", name: "6ème C", grade_level_id: "lvl-1" },
    ]
    expect(pickTargetClass(withC, "lvl-2", "c-1c")).toBeNull()
  })

  it("renvoie null quand plusieurs parallèles correspondent (jamais au hasard)", () => {
    const ambiguous: ClassRef[] = [
      { id: "c-a", name: "5ème A", grade_level_id: "lvl-2" },
      { id: "c-b", name: "Cinquième A", grade_level_id: "lvl-2" },
    ]
    expect(pickTargetClass(ambiguous, "lvl-2", "c-1a")).toBeNull()
  })

  it("renvoie null si le niveau de destination n'a aucune classe", () => {
    expect(pickTargetClass(CLASSES, "lvl-9", "c-1a")).toBeNull()
  })
})

describe("resolveRolloverTarget — décision complète", () => {
  it("ignore un élève exclu ou sans décision", () => {
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-1",
        classId: "c-1a",
        decision: "excluded",
      })
    ).toEqual({ kind: "skipped", reason: "excluded" })

    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-1",
        classId: "c-1a",
        decision: "pending",
      })
    ).toEqual({ kind: "skipped", reason: "pending" })

    // Décision inconnue (valeur inattendue en base) : traitée comme non tranchée.
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-1",
        classId: null,
        decision: "??",
      })
    ).toEqual({ kind: "skipped", reason: "pending" })
  })

  it("promeut un admis au rang suivant, avec la classe du niveau cible", () => {
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-1",
        classId: "c-1a",
        decision: "admitted",
      })
    ).toEqual({ kind: "enrolled", gradeLevelId: "lvl-2", classId: "c-2a" })
  })

  it("maintient un redoublant dans son niveau et sa classe", () => {
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-1",
        classId: "c-1a",
        decision: "repeated",
      })
    ).toEqual({ kind: "enrolled", gradeLevelId: "lvl-1", classId: "c-1a" })
  })

  it("diplôme un admis au dernier rang de l'école", () => {
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-3",
        classId: null,
        decision: "admitted",
      })
    ).toEqual({ kind: "graduated" })
  })

  it("ne devine pas de rang pour un niveau absent du référentiel", () => {
    // Niveau supprimé/mal configuré : l'élève reste dans son niveau connu au
    // lieu d'être promu vers un rang inexistant.
    expect(
      resolveRolloverTarget(LEVELS, CLASSES, {
        gradeLevelId: "lvl-inconnu",
        classId: null,
        decision: "admitted",
      })
    ).toEqual({ kind: "enrolled", gradeLevelId: "lvl-inconnu", classId: null })
  })
})
