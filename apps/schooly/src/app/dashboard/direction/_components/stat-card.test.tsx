// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (le paquet embarque sa
// propre copie de React, ce qui casse les hooks en jsdom).
vi.mock("lucide-react", () => ({
  TrendingUp: () => null,
  Users: () => null,
}))

// Stub local : l'icône est un simple composant factice dans ce test.
const Users = () => null
import { StatCard } from "./stat-card"

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

function renderCard(ui: React.ReactElement) {
  root = createRoot(container)
  act(() => { root!.render(ui) })
}

describe("StatCard", () => {
  it("affiche le libellé, la valeur et le hint", () => {
    renderCard(
      <StatCard label="Élèves inscrits" value="320" icon={Users} tone="primary" hint="12 nouvelles ce mois" />,
    )

    expect(container.textContent).toContain("Élèves inscrits")
    expect(container.textContent).toContain("320")
    expect(container.textContent).toContain("12 nouvelles ce mois")
  })

  it("affiche une tendance positive en vert avec le signe plus", () => {
    renderCard(<StatCard label="K" value="1" icon={Users} tone="green" trend={12.5} />)

    const pill = [...container.querySelectorAll("span")].find((s) => s.textContent === "+12.5 %")
    expect(pill).toBeDefined()
    expect(pill!.className).toContain("text-green-600")
  })

  it("affiche une tendance négative en rouge et marque « Nouveau » sur null", () => {
    renderCard(<StatCard label="K" value="1" icon={Users} tone="blue" trend={-3.2} />)
    const down = [...container.querySelectorAll("span")].find((s) => s.textContent === "-3.2 %")
    expect(down!.className).toContain("text-destructive")

    renderCard(<StatCard label="K" value="2" icon={Users} tone="blue" trend={null} />)
    expect(container.textContent).toContain("Nouveau")
  })

  it("borne la barre de progression entre 0 et 100 %", () => {
    renderCard(<StatCard label="K" value="1" icon={Users} tone="amber" progress={130} />)

    const bar = container.querySelector<HTMLElement>("[style*=width]")
    expect(bar).not.toBeNull()
    expect(bar!.style.width).toBe("100%")
  })
})
