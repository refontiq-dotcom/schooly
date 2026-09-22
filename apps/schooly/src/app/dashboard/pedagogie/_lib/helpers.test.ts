import { describe, expect, it } from "vitest"
import {
  buildEnrollmentOptions,
  buildPedagogieGuidance,
  canRecordDecision,
  canWriteTeachingContent,
  decisionBadge,
  formatDeadline,
  formatSessionDay,
  formatShortDate,
  sessionTimeRange,
  studentDisplayName,
} from "./helpers"
import { makeDecision, makeEnrollmentRow, makeSession } from "./test-fixtures"

describe("formatage des séances", () => {
  it("affiche le jour court d'une séance", () => {
    expect(formatSessionDay(makeSession().starts_at)).toBe("lun. 12 janv.")
  })

  it("compose la plage horaire de la séance", () => {
    expect(sessionTimeRange("2026-01-12T07:10:00", "2026-01-12T08:00:00")).toBe("07:10 — 08:00")
  })

  it("affiche l'échéance d'un devoir en toutes lettres", () => {
    expect(formatDeadline("2026-01-16T10:00:00")).toBe("vendredi 16 janvier")
  })

  it("retombe sur un tiret quand la date de décision est absente ou invalide", () => {
    expect(formatShortDate("2026-01-15T09:00:00")).toBe("15/01/2026")
    expect(formatShortDate(null)).toBe("—")
    expect(formatShortDate("pas-une-date")).toBe("—")
  })
})

describe("identité élève", () => {
  it("assemble prénom et nom en ignorant les champs absents", () => {
    expect(studentDisplayName({ first_name: "Aya", last_name: "Kouadio" })).toBe("Aya Kouadio")
    expect(studentDisplayName({ first_name: null, last_name: "Kouadio" })).toBe("Kouadio")
    expect(studentDisplayName({ first_name: "Aya", last_name: null })).toBe("Aya")
    expect(studentDisplayName(null)).toBe("Élève")
  })
})

describe("options d'inscription", () => {
  it("produit un libellé nom + prénom + classe", () => {
    expect(buildEnrollmentOptions([makeEnrollmentRow()])).toEqual([
      { id: "e1", label: "Kouadio Aya — 6e B" },
    ])
  })

  it("omet la classe absente et ne laisse pas d'espace double", () => {
    expect(
      buildEnrollmentOptions([
        makeEnrollmentRow({ classes: null, students: { id: "st1", first_name: "Aya", last_name: null } }),
      ]),
    ).toEqual([{ id: "e1", label: "Aya" }])
  })
})

describe("badges de décision du conseil de classe", () => {
  it("couvre les quatre décisions avec leur style", () => {
    expect(decisionBadge("admitted")).toEqual({
      label: "Admis",
      variant: "default",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    })
    expect(decisionBadge("repeated")).toEqual({
      label: "Redouble",
      variant: "secondary",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    })
    expect(decisionBadge("excluded")).toEqual({ label: "Exclu", variant: "destructive" })
    expect(decisionBadge("pending")).toEqual({ label: "En attente", variant: "outline" })
    expect(decisionBadge("inconnu")).toEqual({ label: "En attente", variant: "outline" })
  })
})

describe("guidance pédagogique", () => {
  const readySignals = {
    hasCurrentYear: true,
    plannedYearLabel: null,
    classesCount: 4,
    subjectsCount: 6,
    sessionsCount: 3,
  }

  it("ne signale rien quand la structure et le planning sont prêts", () => {
    expect(buildPedagogieGuidance(readySignals)).toEqual([])
  })

  it("alerte en criticité sur l'année, les classes et les matières manquantes", () => {
    const items = buildPedagogieGuidance({
      hasCurrentYear: false,
      plannedYearLabel: null,
      classesCount: 0,
      subjectsCount: 0,
      sessionsCount: 0,
    })

    expect(items.map((i) => i.id)).toEqual(["year", "classes", "subjects"])
    expect(items.every((i) => i.severity === "critical" || i.severity === "action")).toBe(true)
    expect(items[0].actionLabel).toBe("Ouvrir la structure")
    expect(items[0].action).toBe("open-structure")
    expect(items[1].title).toContain("classe")
    expect(items[2].severity).toBe("action")
  })

  it("propose d'activer l'année planifiée plutôt que d'en créer une", () => {
    const items = buildPedagogieGuidance({
      hasCurrentYear: false,
      plannedYearLabel: "2026-2027",
      classesCount: 4,
      subjectsCount: 6,
      sessionsCount: 0,
    })

    expect(items[0].actionLabel).toBe("Activer 2026-2027")
    expect(items[0].description).toContain("2026-2027")
    // L'onglet Cours ne peut rien programmer sans année : pas d'invite au planning.
    expect(items.some((i) => i.id === "schedule")).toBe(false)
  })

  it("invite à programmer un premier cours quand la structure est prête", () => {
    const items = buildPedagogieGuidance({ ...readySignals, sessionsCount: 0 })

    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("schedule")
    expect(items[0].actionLabel).toBe("Programmer un cours")
    expect(items[0].action).toBe("scroll-to-sessions")
  })
})

describe("gardes d'affichage des modales", () => {
  it("réserve les cours et devoirs aux professeurs et à la direction", () => {
    expect(canWriteTeachingContent("professeur")).toBe(true)
    expect(canWriteTeachingContent("direction")).toBe(true)
    expect(canWriteTeachingContent("surveillance")).toBe(false)
    expect(canWriteTeachingContent(null)).toBe(false)
    expect(canWriteTeachingContent(undefined)).toBe(false)
  })

  it("réserve les décisions à la direction et au super admin", () => {
    expect(canRecordDecision("direction")).toBe(true)
    expect(canRecordDecision("super_admin")).toBe(true)
    expect(canRecordDecision("professeur")).toBe(false)
    expect(canRecordDecision(null)).toBe(false)
  })

  it("expose une décision complète pour l'affichage du conseil", () => {
    const decision = makeDecision()
    expect(decision.enrollments?.students?.first_name).toBe("Aya")
    expect(decision.academic_years?.label).toBe("2025-2026")
  })
})
