// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Play: () => null,
  CalendarDays: () => null,
  CheckCircle2: () => null,
  AlertTriangle: () => null,
  Loader2: () => null,
  RotateCcw: () => null,
  TrendingUp: () => null,
  XCircle: () => null,
  Clock: () => null,
  ChevronRight: () => null,
  History: () => null,
}))

vi.mock("./actions", () => ({ getAcademicYears: vi.fn() }))
vi.mock("./rollover-actions", () => ({
  canRunRollover: vi.fn(),
  getRolloverLogs: vi.fn(),
  getRolloverPreview: vi.fn(),
  executeRollover: vi.fn(),
  setEnrollmentDecision: vi.fn(),
}))

import { getAcademicYears } from "./actions"
import {
  canRunRollover,
  getRolloverLogs,
  getRolloverPreview,
} from "./rollover-actions"
import { YearRolloverPanel } from "./year-rollover-panel"

const ACTIVE_YEAR = {
  id: "y-2025",
  label: "2025-2026",
  start_date: "2025-09-01",
  end_date: "2026-06-30",
  status: "en_cours",
}

const PLANNED_YEAR = {
  id: "y-2026",
  label: "2026-2027",
  start_date: "2026-09-01",
  end_date: "2027-06-30",
  status: "planifiee",
}

const A_LOG = {
  id: "log-1",
  status: "completed",
  initiated_at: "2026-09-01T10:00:00.000Z",
  students_promoted: 42,
  students_repeated: 3,
  students_excluded: 1,
  students_without_class: 0,
  old_year: { label: "2024-2025" },
  new_year: { label: "2025-2026" },
  initiator: { full_name: "Alice Traoré" },
}

type Overrides = {
  years?: unknown[]
  allowed?: boolean
  accessError?: string
  logs?: unknown[]
}

async function renderPanel(overrides: Overrides = {}) {
  vi.mocked(getAcademicYears).mockResolvedValue({
    data: overrides.years ?? [ACTIVE_YEAR, PLANNED_YEAR],
  } as never)
  vi.mocked(canRunRollover).mockResolvedValue({
    allowed: overrides.allowed ?? true,
    error: overrides.accessError,
  })
  vi.mocked(getRolloverLogs).mockResolvedValue({
    data: overrides.logs ?? [],
  } as never)

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  await act(async () => {
    root.render(<YearRolloverPanel />)
  })
  return { container, root }
}

function clickByText(container: HTMLElement, text: string) {
  const target = Array.from(container.querySelectorAll("button, span, a")).find(
    (el) => el.textContent?.trim() === text,
  ) as HTMLElement | undefined
  if (!target) throw new Error(`Élément cliquable « ${text} » introuvable`)
  act(() => target.click())
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.clearAllMocks()
})

describe("YearRolloverPanel", () => {
  it("liste les années académiques avec leur statut", async () => {
    const { container, root } = await renderPanel()
    expect(container.textContent).toContain("2025-2026")
    expect(container.textContent).toContain("2026-2027")
    expect(container.textContent).toContain("En cours")
    expect(container.textContent).toContain("Planifiée")
    await act(async () => root.unmount())
  })

  it("affiche l'état vide quand aucune année n'est configurée", async () => {
    const { container, root } = await renderPanel({ years: [] })
    expect(container.textContent).toContain("Aucune année configurée.")
    await act(async () => root.unmount())
  })

  it("explique le refus d'accès et masque la bascule pour un rôle non autorisé", async () => {
    const { container, root } = await renderPanel({
      allowed: false,
      accessError: "La bascule est réservée à la direction.",
    })
    expect(container.textContent).toContain("Bascule non disponible")
    expect(container.textContent).toContain("réservée à la direction")
    expect(container.textContent).not.toContain("Prévisualiser la bascule")
    await act(async () => root.unmount())
  })

  it("prévient quand aucune année planifiée n'existe pour la destination", async () => {
    const { container, root } = await renderPanel({ years: [ACTIVE_YEAR] })
    expect(container.textContent).toContain("Aucune année planifiée.")
    expect(container.textContent).toContain("Prévisualiser la bascule")
    await act(async () => root.unmount())
  })

  it("masque l'historique par défaut puis affiche l'état vide via le toggle", async () => {
    const { container, root } = await renderPanel({ logs: [] })
    expect(container.textContent).not.toContain("Aucune bascule effectuée.")
    clickByText(container, "Afficher")
    expect(container.textContent).toContain("Aucune bascule effectuée.")
    clickByText(container, "Masquer")
    expect(container.textContent).not.toContain("Aucune bascule effectuée.")
    await act(async () => root.unmount())
  })

  it("détaille chaque bascule de l'historique (années, auteur, volumes)", async () => {
    const { container, root } = await renderPanel({ logs: [A_LOG] })
    clickByText(container, "Afficher")
    expect(container.textContent).toContain("2024-2025 → 2025-2026")
    expect(container.textContent).toContain("Alice Traoré")
    expect(container.textContent).toContain("Réussie")
    expect(container.textContent).toContain("+42")
    await act(async () => root.unmount())
  })

  it("pré-sélectionne l'année en cours comme source", async () => {
    const { container, root } = await renderPanel()
    const select = container.querySelector("#old-year") as HTMLSelectElement
    expect(select.value).toBe("y-2025")
    // La destination ne propose que les années planifiées.
    const options = Array.from(
      (container.querySelector("#new-year") as HTMLSelectElement).options,
    ).map((o) => o.textContent)
    expect(options).toContain("2026-2027")
    expect(options).not.toContain("2025-2026 (En cours)")
    await act(async () => root.unmount())
  })

  it("passe à l'étape Prévisualisation et expose l'action d'exécution", async () => {
    vi.mocked(getRolloverPreview).mockResolvedValue({
      data: {
        total: 2,
        admitted: 1,
        repeated: 1,
        excluded: 0,
        pending: 0,
        withoutClass: 0,
        graduated: 0,
        enrollments: [
          {
            id: "e1",
            studentName: "Awa Koné",
            className: "6e A",
            gradeLevelName: "6e",
            gradeLevelOrder: 1,
            decision: "admitted",
            targetStatus: "enrolled",
            targetClassId: "c7",
            targetClassName: "7e A",
          },
        ],
      },
    } as never)

    const { container, root } = await renderPanel()
    const newYearSelect = container.querySelector("#new-year") as HTMLSelectElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!
      setter.call(newYearSelect, "y-2026")
      newYearSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })
    clickByText(container, "Prévisualiser la bascule")
    await act(async () => {})

    expect(container.textContent).toContain("Classe actuelle")
    expect(container.textContent).toContain("Awa Koné")
    expect(container.textContent).toContain("Lancer la bascule (2 élèves)")
    await act(async () => root.unmount())
  })
})
