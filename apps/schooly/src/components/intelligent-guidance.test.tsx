// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

// Le lockfile installe deux copies de react : lucide-react résout la copie
// locale et casse les hooks en jsdom. Ce test porte sur la persistance, pas SVG.
vi.mock("lucide-react", () => ({
  ArrowRight: () => null,
  BrainCircuit: () => null,
  ChevronDown: () => null,
  CircleAlert: () => null,
  Info: () => null,
  Lightbulb: () => null,
  ShieldAlert: () => null,
  X: () => null,
}))

import { IntelligentGuidance } from "./intelligent-guidance"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  window.localStorage.clear()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.localStorage.clear()
})

it("persiste une suggestion ignorée et la retire immédiatement", async () => {
  await act(async () => {
    root.render(
      <IntelligentGuidance
        contextKey="test-guidance"
        items={[{ id: "missing-year", title: "Année manquante", description: "Préparez la structure.", severity: "warning" }]}
      />,
    )
  })

  expect(container.textContent).toContain("Année manquante")
  const dismissButton = container.querySelector<HTMLButtonElement>('button[aria-label="Ignorer cette suggestion pour 7 jours"]')
  expect(dismissButton).not.toBeNull()

  await act(async () => {
    dismissButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })

  expect(container.textContent).not.toContain("Année manquante")
  const stored = JSON.parse(window.localStorage.getItem("schooly:guidance:test-guidance") ?? "{}") as {
    "missing-year"?: { hash: string; until: number }
  }
  expect(stored["missing-year"]?.hash).toContain("Année manquante::Préparez la structure.")
  expect(stored["missing-year"]?.until).toBeGreaterThan(Date.now())
})