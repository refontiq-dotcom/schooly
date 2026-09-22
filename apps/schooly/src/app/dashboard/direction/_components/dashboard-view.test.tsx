// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DirectionDashboard } from "../dashboard-data"
import { DashboardView } from "./dashboard-view"

// La bannière guidance est un composant client lourd : on la remplace par un
// repère testable — le test porte sur la COMPOSITION, pas sur son contenu.
vi.mock("@/components/intelligent-guidance", () => ({
  IntelligentGuidance: (props: { title: string }) => (
    <div data-testid="guidance">{props.title}</div>
  ),
}))

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Users: () => null,
  CreditCard: () => null,
  TrendingUp: () => null,
  AlertCircle: () => null,
  AlertTriangle: () => null,
  Bell: () => null,
  Clock: () => null,
  CheckCircle2: () => null,
  ShieldCheck: () => null,
  ArrowRight: () => null,
  Wallet: () => null,
  CalendarDays: () => null,
  GraduationCap: () => null,
}))

export function makeDashboard(
  overrides: Partial<DirectionDashboard> = {},
): DirectionDashboard {
  return {
    hasData: true,
    activeYear: { id: "y1", label: "2025-2026", startDate: "2025-09-01", endDate: "2026-06-30" },
    previousYear: { id: "y0", label: "2024-2025" },
    students: {
      active: 320,
      newThisMonth: 12,
      previousYearActive: 300,
      deltaCount: 20,
      deltaPercent: 6.7,
      byLevel: [
        { id: "l1", name: "CM2 A", cycle: "primaire", count: 40, capacity: 42, fillRate: 95 },
        { id: "l2", name: "6e B", cycle: "college", count: 30, capacity: 45, fillRate: 67 },
      ],
    },
    finance: {
      collectedThisMonth: 1_500_000,
      collectedPreviousMonth: 1_200_000,
      collectedDeltaPercent: 25,
      collectedThisYear: 9_000_000,
      expectedThisYear: 12_000_000,
      recoveryRate: 75,
      outstanding: 3_000_000,
      debtorsCount: 14,
      daily: [
        { date: "2026-02-01", total: 50_000 },
        { date: "2026-02-02", total: 0 },
      ],
      byMethod: [
        { method: "cash", total: 6_000_000 },
        { method: "mobile_money", total: 3_000_000 },
      ],
      topDebtors: [
        { id: "d1", name: "Yao Awa", matricule: "M-001", balance: 90_000 },
      ],
    },
    actionQueue: [
      { key: "pre_enrollments", label: "Pré-inscriptions", detail: null, count: 3, href: "/x", tone: "warning" },
      { key: "notifications", label: "Notifications", detail: null, count: 0, href: null, tone: "info" },
    ],
    cash: {
      isOpen: true,
      openedAt: "2026-02-01T08:00:00Z",
      openingAmount: 100_000,
      collectedInSession: 250_000,
      expectedInSession: 350_000,
      lastDifference: 0,
      lastClosedAt: null,
    },
    ...overrides,
  }
}

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

describe("DashboardView — composition", () => {
  it("affiche les 4 KPI prioritaires", () => {
    renderView(<DashboardView dashboard={makeDashboard()} />)

    expect(container.textContent).toContain("Élèves inscrits")
    expect(container.textContent).toContain("Encaissé ce mois")
    expect(container.textContent).toContain("Taux de recouvrement")
    expect(container.textContent).toContain("Reste à recouvrer")
  })

  it("affiche la bannière guidance AVANT la file d'actions (ordre de lecture)", () => {
    renderView(<DashboardView dashboard={makeDashboard()} />)

    const text = container.textContent ?? ""
    expect(text.indexOf("Schooly anticipe")).toBeGreaterThan(-1)
    expect(text.indexOf("Schooly anticipe")).toBeLessThan(text.indexOf("Actions requises"))
  })

  it("place Actions, Impayés et Caisse dans une même grille 3 colonnes", () => {
    renderView(<DashboardView dashboard={makeDashboard()} />)

    const balancedGrid = container.querySelector(".lg\\:grid-cols-3")
    expect(balancedGrid).not.toBeNull()
    expect(balancedGrid!.textContent).toContain("Actions requises")
    expect(balancedGrid!.textContent).toContain("Reste à recouvrer")
    expect(balancedGrid!.textContent).toContain("Caisse")
  })

  it("aligne Encaissements et Effectifs sur une grille 2 colonnes équilibrée", () => {
    renderView(<DashboardView dashboard={makeDashboard()} />)

    const chartsRow = container.querySelector(".lg\\:grid-cols-2")
    expect(chartsRow).not.toBeNull()
    expect(chartsRow!.textContent).toContain("Encaissements des")
    expect(chartsRow!.textContent).toContain("Effectif par niveau")
    // le graphe ne doit plus déborder sur la grille (col-span-2 supprimé)
    expect(chartsRow!.querySelector(".lg\\:col-span-2")).toBeNull()
  })

  it("n'affiche ni KPI ni widgets quand l'établissement n'est pas configuré", () => {
    renderView(<DashboardView dashboard={makeDashboard({ hasData: false })} />)

    expect(container.textContent).toMatch(/pas encore configuré/i)
    expect(container.textContent).not.toContain("Élèves inscrits")
    expect(container.querySelector(".lg\\:grid-cols-3")).toBeNull()
  })
})
