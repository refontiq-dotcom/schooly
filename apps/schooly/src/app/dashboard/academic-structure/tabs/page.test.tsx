// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  loaders: {} as Record<string, number>,
  getAcademicYears: vi.fn(),
}))

vi.mock("@/hooks/use-supabase-user", () => ({ useSupabaseUser: () => ({ role: "direction" }) }))
vi.mock("lucide-react", () => ({
  Plus: () => null, Play: () => null, BookOpen: () => null, GraduationCap: () => null,
  Users: () => null, FileText: () => null, LayoutGrid: () => null, RotateCw: () => null,
  Loader2: () => null, Pencil: () => null, Trash2: () => null, ArrowRight: () => null, CheckCircle2: () => null,
  CircleAlert: () => null, LockKeyhole: () => null,
}))
vi.mock("@/components/action-form", () => ({ ActionForm: ({ children }: { children?: React.ReactNode }) => <form>{children}</form> }))
vi.mock("../academic-guidance", () => ({ AcademicGuidancePanel: () => <p>Guidance</p> }))
vi.mock("../year-rollover-panel", () => ({ YearRolloverPanel: () => <div>Bascule</div> }))
vi.mock("../actions", () => {
  const inc = (key: string) => () => { mocks.loaders[key] = (mocks.loaders[key] ?? 0) + 1; return { data: [] } }
  return {
    getAcademicYears: mocks.getAcademicYears,
    getGradeLevels: inc("levels"),
    getClasses: inc("classes"),
    getSubjects: inc("subjects"),
    getClassSubjectAssignments: inc("matrix"),
    getTeachersForSchool: async () => ({ data: [] }),
    createAcademicYear: async () => ({}), createGradeLevel: async () => ({}), createClass: async () => ({}),
    createSubject: async () => ({}), createClassSubjectAssignment: async () => ({}),
    updateSubject: async () => ({}), archiveSubject: async () => ({}), updateClass: async () => ({}), archiveClass: async () => ({}),
    updateGradeLevel: async () => ({}), archiveGradeLevel: async () => ({}), archiveAcademicYear: async () => ({}),
    updateClassSubjectAssignment: async () => ({}), archiveClassSubjectAssignment: async () => ({}),
  }
})
vi.mock("../rollover-actions", () => ({ activateAcademicYear: async () => ({}) }))
vi.mock("@/components/academic-year-selector", () => ({ computeAcademicWindow: () => ({ label: "2025" }) }))
// Les mocks pointent le même alias absolu que lazy() règle depuis tabs/page.tsx,
// sinon le lazy résout réellement le module et déclenche le loader Supabase.
vi.mock("@/app/dashboard/academic-structure/years/page", () => ({ __esModule: true, default: () => <div data-testid="years-pane">Annees</div> }))
vi.mock("@/app/dashboard/academic-structure/levels/page", () => ({ __esModule: true, default: () => <div data-testid="levels-pane">Niveaux</div> }))
vi.mock("@/app/dashboard/academic-structure/classes/page", () => ({ __esModule: true, default: () => <div data-testid="classes-pane">Classes</div> }))
vi.mock("@/app/dashboard/academic-structure/subjects/page", () => ({ __esModule: true, default: () => <div data-testid="subjects-pane">Matieres</div> }))
vi.mock("@/app/dashboard/academic-structure/years/rollover", () => ({ __esModule: true, default: () => <div data-testid="rollover-pane">Bascule</div> }))
vi.mock("@/app/dashboard/academic-structure/matrix/page", () => ({ __esModule: true, default: () => <div data-testid="matrix-pane">Matrice Classe × Matiere</div> }))

import AcademicStructurePage from "./page"

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.getAcademicYears.mockResolvedValue({
    data: [{ id: "y", label: "2025", status: "en_cours" }], error: undefined,
  })
  for (const k of Object.keys(mocks.loaders)) delete mocks.loaders[k]
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<AcademicStructurePage />) })
  await act(async () => {})
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function tabLabels() {
  return [...container.querySelectorAll("[role=tab]")].map((t) => t.textContent ?? "")
}

async function clickTab(label: string) {
  const tab = [...container.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent?.includes(label))!
  await act(async () => { tab.dispatchEvent(new MouseEvent("click", { bubbles: true })) })
  await act(async () => {})
}

it("exposer les 6 onglets", () => {
  expect(tabLabels()).toEqual(expect.arrayContaining(["Années", "Niveaux", "Classes", "Matières", "Matrice", "Bascule"]))
})

it("affiche annee en cours", () => {
  expect(container.textContent).toContain("Année en cours")
})

it("masque matrice au montage", () => {
  expect(container.textContent).not.toContain("Nouvelle affectation")
})

it("dvoile matrice apres clic", async () => {
  await clickTab("Matrice")
  expect(container.textContent).toContain("Matrice Classe")
})

it("masque la matrice tant qu'aucune année n'est active", async () => {
  mocks.getAcademicYears.mockResolvedValue({ data: [{ id: "y", label: "2026", status: "planifiee" }], error: undefined })
  await act(async () => { root.render(<AcademicStructurePage />) })
  await act(async () => {})
  // Pas d'onglet Matrice tant qu'aucune année n'est en cours.
  expect(tabLabels()).not.toContain("Matrice")
})

it("ouvre annee et rend le pane years (lazy)", async () => {
  // Au montage, le pane years est lazy mais rendu (onglet actif par défaut).
  expect(container.querySelector("[data-testid=years-pane]")).not.toBeNull()
  // "2025" provient du libellé « Année en cours » du hub.
  expect(container.textContent).toContain("2025")
})
