// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Users: () => null,
  Plus: () => null,
  UtensilsCrossed: () => null,
  CalendarDays: () => null,
}))

vi.mock("@/components/action-form", () => ({
  ActionForm: ({
    children,
    action,
  }: {
    children?: React.ReactNode
    action: (formData: FormData) => Promise<unknown>
  }) => (
    <form
      data-testid="action-form"
      onSubmit={(event) => {
        event.preventDefault()
        void action(new FormData(event.currentTarget))
      }}
    >
      {children}
    </form>
  ),
}))

import { CantineView } from "./cantine-view"
import { makeEnrollment, makeMenu, makeSub } from "../../_lib/test-fixtures"

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

const handlers = {
  onCreateMenu: vi.fn(async () => ({ ok: true })),
  onCreateSub: vi.fn(async () => ({ ok: true })),
}

beforeEach(() => {
  for (const fn of Object.values(handlers)) fn.mockClear()
})

describe("CantineView — composition", () => {
  it("affiche les 3 stats : abonnés actifs, menus de la semaine, montants encaissés", () => {
    renderView(
      <CantineView
        menus={[makeMenu({}), makeMenu({ id: "m2" })]}
        subs={[makeSub({ status: "active", amount_cfa: 25_000 }), makeSub({ id: "s2", status: "active", amount_cfa: 75_000 })]}
        enrollments={[]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    const stats = container.querySelectorAll(".text-3xl")
    expect(stats[0].textContent).toBe("2") // abonnés actifs
    expect(stats[1].textContent).toBe("2") // menus
    expect(stats[2].textContent).toBe("100\u202f000") // FCFA encaissés (format fr-FR, espace fine insécable)
    expect(container.textContent).toContain("FCFA encaissés")
  })

  it("affiche chaque menu avec sa date, son type de repas et sa description", () => {
    renderView(
      <CantineView
        menus={[makeMenu({ date: "2026-01-14", meal_type: "lunch", description: "Riz gras au poulet" })]}
        subs={[]}
        enrollments={[]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    // Format semaine : du L au V (libellés fr)
    expect(text).toContain("Menus de la semaine")
    expect(text).toContain("Riz gras au poulet")
    expect(text).toContain("Déjeuner")
    expect(text).toContain("14 janv.")
  })

  it("affiche l'état vide quand aucun menu n'est planifié", () => {
    renderView(
      <CantineView
        menus={[]}
        subs={[]}
        enrollments={[]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    expect(container.textContent).toContain("Aucun menu planifié pour cette semaine.")
  })

  it("affiche la table des abonnements : élève, plan, montant, statut", () => {
    renderView(
      <CantineView
        menus={[]}
        subs={[
          makeSub({
            plan_type: "monthly",
            amount_cfa: 25_000,
            start_date: "2026-01-15",
            status: "active",
          }),
        ]}
        enrollments={[makeEnrollment()]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Kouadio Aya")
    expect(text).toContain("Mensuel")
    expect(text).toContain("25\u202f000 FCFA")
    expect(text).toContain("15/01/2026")
    expect(text).toContain("Actif")
  })

  it("affiche l'état vide des abonnements", () => {
    renderView(
      <CantineView
        menus={[]}
        subs={[]}
        enrollments={[]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    expect(container.textContent).toContain("Aucun abonnement cantine.")
  })

  it("affiche le formulaire de menu après clic et le referme après création réussie", async () => {
    renderView(
      <CantineView
        menus={[]}
        subs={[]}
        enrollments={[]}
        weekFrom="2026-01-12"
        weekTo="2026-01-16"
        today="2026-01-14"
        {...handlers}
      />,
    )

    const menuButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Ajouter un menu"),
    )!
    act(() => { menuButton.click() })
    expect(container.querySelector("#menu-desc")).not.toBeNull()

    act(() => {
      container
        .querySelector('[data-testid="action-form"]')!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    expect(handlers.onCreateMenu).toHaveBeenCalledTimes(1)
    expect(container.querySelector("#menu-desc")).toBeNull()
  })
})
