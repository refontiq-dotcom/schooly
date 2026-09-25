// @vitest-environment jsdom
// apps/schooly/src/app/dashboard/direction/admissions/page.test.tsx
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  preEnrollments: vi.fn(async (): Promise<{ data: unknown[] }> => ({ data: [] })),
  students: vi.fn(async (): Promise<{ data: unknown[] }>  => ({ data: [] })),
  guardians: vi.fn(async (): Promise<{ data: unknown[] }>  => ({ data: [] })),
  enrollments: vi.fn(async (): Promise<{ data: unknown[] }> => ({ data: [] })),
}))

vi.mock("@/app/dashboard/admissions/actions", () => ({
  getPreEnrollments: mocks.preEnrollments,
  getStudents: mocks.students,
  getGuardians: mocks.guardians,
  getEnrollments: mocks.enrollments,
}))

// Session authentifiée rattachée à une école ; le reste des tables renvoie vide.
vi.mock("@/utils/supabase/browser", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => {
      if (table === "user_school_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  single: async () => ({ data: { school_id: "school-1" } }),
                }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [] }),
          }),
        }),
      }
    },
  }),
}))

// `next/link` exige le routeur Next : rendu comme simple ancre dans les tests.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// `useRouter` (navigation des actions de guidance, B5) : stub minimal hors
// runtime Next — la page n'appelle que `push`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/components/intelligent-guidance", () => ({
  IntelligentGuidance: () => null,
}))

vi.mock("./counter-enrollment-modal", () => ({
  CounterEnrollmentModal: () => null,
}))

// Le lockfile installe deux copies de react (racine 19.3.0 / app 19.2.8) :
// lucide-react résout la copie locale et casse le rendu. Les icônes sont
// stubbées — ce test porte sur la pagination, pas sur le SVG.
vi.mock("lucide-react", () => ({
  Clock: () => null,
  GraduationCap: () => null,
  Users: () => null,
  FileText: () => null,
  Wallet: () => null,
  ArrowLeftRight: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
}))

import AdmissionsPage from "./page"

function makeStudents(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `student-${String(i + 1).padStart(2, "0")}`,
    first_name: `Prénom${i + 1}`,
    last_name: `Nom${String(i + 1).padStart(2, "0")}`,
    date_of_birth: "2012-05-10",
    status: "active",
    previous_school: null,
    previous_class: null,
    enrollments: [{ grade_levels: { name: "CM2" }, classes: { name: "CM2 A" } }],
  }))
}

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.students.mockResolvedValue({ data: [] })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<AdmissionsPage />)
  })
  await act(async () => {}) // laisse les effets async se terminer
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

/** Ouvre l'onglet « Élèves » (l'onglet par défaut est « Pré-inscriptions »). */
async function openStudentsTab() {
  const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const studentsTab = tabs.find((t) => t.textContent?.includes("Élèves"))!
  await act(async () => {
    studentsTab.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
  await act(async () => {}) // laisse le changement d'onglet se rendre
}

function studentRows() {
  return [...container.querySelectorAll("p.font-medium")].filter((p) =>
    /^Nom\d+\s/.test(p.textContent ?? ""),
  )
}

function paginationButtons() {
  return {
    prev: container.querySelector<HTMLButtonElement>('button[aria-label="Page précédente"]'),
    next: container.querySelector<HTMLButtonElement>('button[aria-label="Page suivante"]'),
  }
}

/** Re-fait le rendu de la page avec un lot d'élèves personnalisé.
 * La clé force le remount → relance le useEffect → getStudents(45). */
async function renderWithStudents(count: number) {
  mocks.students.mockResolvedValue({ data: makeStudents(count) })
  await act(async () => {
    root.render(<AdmissionsPage key={`students-${count}`} />)
  })
  await act(async () => {}) // laisse le chargement asynchrone se terminer
}

// ===========================================================================
// Pagination de la liste des élèves
// ===========================================================================

it("n'affiche que la première page d'élèves avec le compteur", async () => {
  await renderWithStudents(45)
  await openStudentsTab()

  expect(studentRows()).toHaveLength(20)
  expect(container.textContent).toContain("Nom01")
  expect(container.textContent).toContain("Nom20")
  expect(container.textContent).not.toContain("Nom21")
  expect(container.textContent).toContain("45 élèves")
  expect(container.textContent).toContain("page 1 sur 3")
})

it("affiche la deuxième page au clic sur Suivant", async () => {
  await renderWithStudents(45)
  await openStudentsTab()

  const { next } = paginationButtons()
  await act(async () => next!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await act(async () => {})

  expect(studentRows()).toHaveLength(20)
  expect(container.textContent).toContain("Nom21")
  expect(container.textContent).not.toContain("Nom01")
  expect(container.textContent).toContain("page 2 sur 3")
})

it("revient à la première page avec Précédent", async () => {
  await renderWithStudents(45)
  await openStudentsTab()

  await act(async () => paginationButtons().next!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await act(async () => {})
  await act(async () => paginationButtons().prev!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await act(async () => {})

  expect(container.textContent).toContain("Nom01")
  expect(container.textContent).not.toContain("Nom21")
})

it("affiche une dernière page partielle avec Suivant désactivé", async () => {
  await renderWithStudents(45)
  await openStudentsTab()

  await act(async () => paginationButtons().next!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await act(async () => {})
  await act(async () => paginationButtons().next!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await act(async () => {})

  expect(studentRows()).toHaveLength(5)
  expect(container.textContent).toContain("Nom45")
  expect(container.textContent).toContain("page 3 sur 3")
  expect(paginationButtons().next!.disabled).toBe(true)
  expect(paginationButtons().prev!.disabled).toBe(false)
})

it("affiche une liste courte sur une seule page sans boutons", async () => {
  await renderWithStudents(12)
  await openStudentsTab()

  expect(studentRows()).toHaveLength(12)
  expect(container.textContent).toContain("12 élèves")
  expect(container.textContent).toContain("page 1 sur 1")
  expect(paginationButtons().next).toBeNull()
})

it("affiche l'état vide sans pagination quand aucun élève", async () => {
  await openStudentsTab()
  expect(container.textContent).toContain("Aucun élève.")
  expect(container.querySelector("nav[aria-label='Pagination']")).toBeNull()
})
