// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (le paquet embarque sa
// propre copie de React, ce qui casse les hooks en jsdom).
vi.mock("lucide-react", () => ({ Building2: () => null }))

import { ServiceStatCard } from "./service-stat-card"

// Stub local : l'icône est un simple composant factice dans ce test.
const Building2 = ({ className }: { className?: string }) => (
  <i data-testid="icon" className={className} />
)

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

describe("ServiceStatCard", () => {
  it("affiche la valeur, le libellé et l'icône", () => {
    renderCard(
      <ServiceStatCard value={12} label="Dortoirs" icon={Building2} iconClassName="text-primary" />,
    )

    expect(container.textContent).toContain("12")
    expect(container.textContent).toContain("Dortoirs")
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  it("accepte une valeur formatée en texte (montants)", () => {
    renderCard(
      <ServiceStatCard value="1 200" label="FCFA encaissés" icon={Building2} iconClassName="" />,
    )

    expect(container.textContent).toContain("1 200")
    expect(container.textContent).toContain("FCFA encaissés")
  })

  it("propage la classe de teinte à l'icône", () => {
    renderCard(
      <ServiceStatCard value={3} label="Chambres" icon={Building2} iconClassName="text-orange-500" />,
    )

    expect(container.querySelector('[data-testid="icon"]')!.className).toContain("text-orange-500")
  })
})
