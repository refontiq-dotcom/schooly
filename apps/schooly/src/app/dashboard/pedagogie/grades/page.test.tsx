// @vitest-environment jsdom
// apps/schooly/src/app/dashboard/pedagogie/grades/page.test.tsx
// Le module « grades » est un hub : il ne charge aucune donnée métier, il
// oriente vers la saisie (notes) ou les actes officiels (bulletins).
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: { role: "direction" } as { role?: string } | null,
}))

vi.mock("@/hooks/use-supabase-user", () => ({ useSupabaseUser: () => mocks.user }))
vi.mock("lucide-react", () => ({ GraduationCap: () => null, FileText: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import GradesHubPage from "./page"

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.user = { role: "direction" }
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<GradesHubPage />) })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderAs(role: string | null) {
  mocks.user = role === null ? null : { role }
  await act(async () => { root.render(<GradesHubPage />) })
}

function links() {
  return [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))
}

it("présente les deux entrées du module d’évaluation", () => {
  expect(links()).toContain("notes")
  expect(links()).toContain("report-cards")
  expect(container.textContent).toContain("Notes")
  expect(container.textContent).toContain("Bulletins")
})

it("ne charge aucune donnée métier : hubs sans formulaire ni sélecteur", () => {
  expect(container.querySelectorAll("form")).toHaveLength(0)
  expect(container.querySelectorAll("select")).toHaveLength(0)
  expect(container.textContent).not.toContain("Chargement")
})

it("réserve l’entrée bulletins à la direction", async () => {
  await renderAs("professeur")
  expect(links()).toContain("notes")
  expect(links()).not.toContain("report-cards")
  expect(container.textContent).not.toContain("Bulletins")
})

it("explique l’objectif de chaque entrée", () => {
  expect(container.textContent).toContain("Saisir")
  expect(container.textContent).toContain("Générer")
})
