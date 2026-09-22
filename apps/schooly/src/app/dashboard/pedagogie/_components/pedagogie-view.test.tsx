// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  BookOpen: () => null,
  ClipboardList: () => null,
  Calendar: () => null,
  FileText: () => null,
  CalendarPlus: () => null,
  BookPlus: () => null,
  ClipboardCheck: () => null,
  Plus: () => null,
  AlertCircle: () => null,
}))

// La bannière de guidance est réduite à ses items : le test porte sur les
// conditions métier qui les produisent et sur la traduction action → callback.
vi.mock("@/components/intelligent-guidance", () => ({
  IntelligentGuidance: ({
    items,
  }: {
    items: { id: string; title: string; actionLabel?: string; onAction?: () => void }[]
  }) => (
    <div data-testid="guidance">
      {items.map((item) => (
        <button key={item.id} type="button" data-guidance={item.id} onClick={item.onAction}>
          {item.title}|{item.actionLabel}
        </button>
      ))}
    </div>
  ),
}))

// Les trois modales d'écriture sont remplacées par des repères : on vérifie
// leur présence conditionnelle (rôle) et les props qui les alimentent.
vi.mock("../session-modal", () => ({
  CreateSessionModal: ({ currentYearId }: { currentYearId?: string }) => (
    <div data-testid="session-modal">{currentYearId}</div>
  ),
}))
vi.mock("../homework-modal", () => ({
  CreateHomeworkModal: () => <div data-testid="homework-modal" />,
}))
vi.mock("../decision-modal", () => ({
  CreateDecisionModal: ({ students }: { students: { id: string; label: string }[] }) => (
    <div data-testid="decision-modal">{students.map((s) => s.label).join(",")}</div>
  ),
}))

import { PedagogieView } from "./pedagogie-view"
import { SessionsSection } from "./sessions-section"
import { HomeworksSection } from "./homeworks-section"
import { DecisionsSection } from "./decisions-section"
import { buildEnrollmentOptions } from "../_lib/helpers"
import { makeDecision, makeEnrollmentRow, makeHomework, makeSession } from "../_lib/test-fixtures"

let container: HTMLElement
let root: Root | null = null

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  container = document.createElement("div")
  document.body.appendChild(container)
})
afterEach(() => {
  act(() => { root?.unmount() })
  root = null
  container.remove()
})

function renderView(ui: React.ReactElement) {
  root = createRoot(container)
  act(() => { root!.render(ui) })
}

const classes = [{ id: "c1", name: "6e B" }]
const subjects = [{ id: "m1", name: "Mathématiques" }]
const teachers = [{ id: "u1", full_name: "Konan Yao" }]
const years = [{ id: "y1", label: "2025-2026", status: "en_cours" }]

describe("SessionsSection", () => {
  it("liste les séances : classe — matière, jour, horaire, salle et professeur", () => {
    renderView(
      <SessionsSection
        sessions={[makeSession({ room: "Salle 12" })]}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        years={years}
        currentYearId="y1"
        defaultTeacherId="u1"
        canCreate
        onSuccess={vi.fn()}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("6e B — Mathématiques")
    expect(text).toContain("lun. 12 janv.")
    expect(text).toContain("07:10 — 08:00")
    expect(text).toContain("Salle 12")
    expect(text).toContain("Konan Yao")
  })

  it("annonce le professeur à assigner et l'état vide", () => {
    renderView(
      <SessionsSection
        sessions={[makeSession({ users: null })]}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        years={years}
        canCreate={false}
        onSuccess={vi.fn()}
      />,
    )
    expect(container.textContent).toContain("Professeur à assigner")

    act(() => { root?.unmount() })
    root = null
    renderView(
      <SessionsSection
        sessions={[]}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        years={years}
        canCreate={false}
        onSuccess={vi.fn()}
      />,
    )
    expect(container.textContent).toContain("Aucun cours programmé")
  })

  it("n'ouvre la modale de planification qu'avec le droit d'écriture", () => {
    renderView(
      <SessionsSection
        sessions={[]}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        years={years}
        currentYearId="y1"
        canCreate
        onSuccess={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="session-modal"]')?.textContent).toBe("y1")

    act(() => { root?.unmount() })
    root = null
    renderView(
      <SessionsSection
        sessions={[]}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        years={years}
        canCreate={false}
        onSuccess={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="session-modal"]')).toBeNull()
  })
})

describe("HomeworksSection", () => {
  it("signale un devoir en brouillon et affiche son échéance", () => {
    renderView(
      <HomeworksSection
        homeworks={[
          makeHomework({ is_published: false, description: "Réviser les fractions" }),
          makeHomework({ id: "h2", title: "Lecture suivie", is_published: true }),
        ]}
        classes={classes}
        subjects={subjects}
        canCreate
        onSuccess={vi.fn()}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Exercices 12 à 15")
    expect(text).toContain("Brouillon")
    expect(text).toContain("Mathématiques · 6e B")
    expect(text).toContain("Réviser les fractions")
    expect(text).toContain("Échéance : vendredi 16 janvier")
    expect(text).toContain("Lecture suivie")
    expect(container.querySelectorAll('[data-testid="homework-modal"]')).toHaveLength(1)
  })

  it("affiche l'état vide sans devoir", () => {
    renderView(
      <HomeworksSection
        homeworks={[]}
        classes={classes}
        subjects={subjects}
        canCreate={false}
        onSuccess={vi.fn()}
      />,
    )
    expect(container.textContent).toContain("Aucun devoir assigné")
    expect(container.querySelector('[data-testid="homework-modal"]')).toBeNull()
  })
})

describe("DecisionsSection", () => {
  it("résume la décision : élève, classe, année, moyenne et date", () => {
    renderView(
      <DecisionsSection
        decisions={[makeDecision({ observations: "Encouragements du conseil" })]}
        enrollments={[makeEnrollmentRow()]}
        years={years}
        currentYearId="y1"
        canRecord
        onSuccess={vi.fn()}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Aya Kouadio")
    expect(text).toContain("6e B · 2025-2026")
    expect(text).toContain("12,5")
    expect(text).toContain("Admis")
    expect(text).toContain("Encouragements du conseil")
    expect(text).toContain("15/01/2026")
    // Les options du sélecteur proviennent du helper testé séparément.
    expect(container.querySelector('[data-testid="decision-modal"]')?.textContent).toBe(
      buildEnrollmentOptions([makeEnrollmentRow()])[0].label,
    )
  })

  it("nomme un élève absent du référentiel et supporte année/moyenne nulles", () => {
    renderView(
      <DecisionsSection
        decisions={[
          makeDecision({
            id: "d9",
            decision: "pending",
            average: null,
            decided_at: "",
            enrollments: null,
            academic_years: null,
          }),
        ]}
        enrollments={[]}
        years={years}
        canRecord={false}
        onSuccess={vi.fn()}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Élève")
    expect(text).toContain("En attente")
    expect(text).toContain("—")
    expect(container.querySelector('[data-testid="decision-modal"]')).toBeNull()
  })

  it("affiche l'état vide sans décision", () => {
    renderView(
      <DecisionsSection
        decisions={[]}
        enrollments={[]}
        years={years}
        canRecord={false}
        onSuccess={vi.fn()}
      />,
    )
    expect(container.textContent).toContain("Aucune décision enregistrée")
  })
})

describe("PedagogieView — composition et guidance", () => {
  const baseProps = {
    classes,
    subjects,
    teachers,
    years,
    currentYearId: "y1",
    currentYearLabel: "2025-2026",
    defaultTeacherId: "u1",
    sessions: [makeSession()],
    homeworks: [makeHomework()],
    decisions: [makeDecision()],
    enrollments: [makeEnrollmentRow()],
    canWriteContent: true,
    canDecide: true,
    onRefresh: vi.fn(),
    onNavigateToStructure: vi.fn(),
  }

  it("résume la structure dans l'en-tête et affiche les trois onglets", () => {
    renderView(<PedagogieView {...baseProps} />)

    const text = container.textContent ?? ""
    expect(text).toContain("Année en cours : 2025-2026")
    expect(text).toContain("1 classe")
    expect(text).toContain("1 matière")
    expect(text).toContain("Cours & Appels")
    expect(text).toContain("Cahier de texte")
    expect(text).toContain("Conseil de classe")
    expect(container.querySelector('[data-testid="guidance"]')).not.toBeNull()
  })

  it("accorde les compteurs de structure au pluriel", () => {
    renderView(
      <PedagogieView
        {...baseProps}
        classes={[...classes, { id: "c2", name: "5e A" }, { id: "c3", name: "4e A" }]}
        subjects={[...subjects, { id: "m2", name: "Français" }]}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("3 classes")
    expect(text).toContain("2 matières")
  })

  it("affiche la guidance critique quand aucune année n'est active", () => {
    renderView(
      <PedagogieView {...baseProps} currentYearId={undefined} currentYearLabel={undefined} />,
    )

    const banner = container.querySelector('[data-testid="guidance"]')!
    expect(banner.textContent).toContain("Aucune année académique n’est active")
    expect(banner.textContent).toContain("Ouvrir la structure")
  })

  it("relaie la navigation de guidance vers la structure académique", () => {
    const onNavigateToStructure = vi.fn()
    renderView(
      <PedagogieView
        {...baseProps}
        currentYearId={undefined}
        currentYearLabel={undefined}
        onNavigateToStructure={onNavigateToStructure}
      />,
    )

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-guidance="year"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(onNavigateToStructure).toHaveBeenCalledTimes(1)
  })

  it("propose de programmer un cours quand la structure est prête mais sans séance", () => {
    renderView(<PedagogieView {...baseProps} sessions={[]} />)

    expect(container.querySelector('[data-testid="guidance"]')!.textContent).toContain(
      "Programmer un cours",
    )
  })
})
