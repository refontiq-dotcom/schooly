// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  AlertTriangle: () => null,
  CheckCircle2: () => null,
  ArrowRight: () => null,
  AlertCircle: () => null,
  Bell: () => null,
  Clock: () => null,
  ShieldCheck: () => null,
  Users: () => null,
}))
import { ActionQueue } from "./action-queue"
import type { DirectionDashboard } from "../dashboard-data"

type QueueItem = DirectionDashboard["actionQueue"][number]

function item(overrides: Partial<QueueItem>): QueueItem {
  return {
    key: "k",
    label: "Élément",
    detail: null,
    count: 1,
    href: null,
    tone: "info",
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

function renderQueue(ui: React.ReactElement) {
  root = createRoot(container)
  act(() => { root!.render(ui) })
}

describe("ActionQueue", () => {
  it("masque les entrées à zéro et affiche le compteur des autres", () => {
    renderQueue(
      <ActionQueue
        items={[
          item({ key: "a", label: "Pré-inscriptions", count: 3, href: "/p" }),
          item({ key: "b", label: "Notifications", count: 0 }),
        ]}
      />,
    )

    expect(container.textContent).toContain("Pré-inscriptions")
    expect(container.textContent).not.toContain("Notifications")
    expect(container.textContent).toContain("3")
  })

  it("rend un lien cliquable quand l'entrée porte un href", () => {
    renderQueue(<ActionQueue items={[item({ label: "À traiter", href: "/todo" })]} />)

    const link = [...container.querySelectorAll("a")].find((a) =>
      (a.getAttribute("href") ?? "") === "/todo",
    )
    expect(link).toBeDefined()
    expect(link!.textContent).toContain("À traiter")
  })

  it("affiche un état vert quand aucune action n'est en attente", () => {
    renderQueue(<ActionQueue items={[item({ count: 0 })]} />)

    expect(container.textContent).toMatch(/aucune action en attente/i)
    expect(container.querySelector(".bg-green-50")).not.toBeNull()
  })
})
