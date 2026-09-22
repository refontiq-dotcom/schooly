// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { StatusBadge, SERVICE_STATUS_LABELS } from "./status-badge"

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

function renderBadge(ui: React.ReactElement) {
  root = createRoot(container)
  act(() => { root!.render(ui) })
}

describe("StatusBadge", () => {
  it("affiche le libellé français des statuts connus", () => {
    renderBadge(<StatusBadge status="active" />)
    expect(container.textContent).toBe("Actif")

    renderBadge(<StatusBadge status="suspended" />)
    expect(container.textContent).toBe("Suspendu")

    renderBadge(<StatusBadge status="cancelled" />)
    expect(container.textContent).toBe("Annulé")
  })

  it("reprend le statut brut quand il est inconnu", () => {
    renderBadge(<StatusBadge status="nouveau_statut" />)
    expect(container.textContent).toBe("nouveau_statut")
  })

  it("expose tous les statuts partagés internat, cantine et transport", () => {
    expect(Object.keys(SERVICE_STATUS_LABELS).sort()).toEqual(
      ["active", "cancelled", "suspended"],
    )
  })
})
