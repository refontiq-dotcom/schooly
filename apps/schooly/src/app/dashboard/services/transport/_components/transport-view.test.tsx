// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Bus: () => null,
  MapPin: () => null,
  Users: () => null,
  Plus: () => null,
  AlertCircle: () => null,
}))

// La bannière guidance est remplacée par un repère testable : on rend le
// titre de CHAQUE item, dans l'ordre — le test porte sur les conditions
// métier qui produisent la guidance, pas sur son rendu interne.
vi.mock("@/components/intelligent-guidance", () => ({
  IntelligentGuidance: ({ items }: { items: { id: string; title: string }[] }) => (
    <div data-testid="guidance">
      {items.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  ),
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

import { TransportView } from "./transport-view"
import { makeBusRoute, makeEnrollment, makeTransportSub } from "../../_lib/test-fixtures"

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
  onCreateRoute: vi.fn(async () => ({ ok: true })),
  onCreateSub: vi.fn(async () => ({ ok: true })),
  onOpenAdmissions: vi.fn(),
}

beforeEach(() => {
  for (const fn of Object.values(handlers)) fn.mockClear()
})

describe("TransportView — composition", () => {
  it("affiche les 3 stats : lignes de bus, abonnés actifs, arrêts enregistrés", () => {
    const routes = [
      makeBusRoute({ bus_stops: [{ id: "s1", name: "Cocody", pickup_time: "07:10" }, { id: "s2", name: "Angré" }] }),
      makeBusRoute({ id: "r2", name: "Ligne Sud", bus_stops: [{ id: "s3", name: "Marcory" }] }),
    ]
    renderView(
      <TransportView
        routes={routes}
        subs={[makeTransportSub({}), makeTransportSub({ id: "t2", status: "cancelled" })]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    const stats = container.querySelectorAll(".text-3xl")
    expect(stats[0].textContent).toBe("2") // lignes
    expect(stats[1].textContent).toBe("1") // abonnés actifs
    expect(stats[2].textContent).toBe("3") // arrêts (2 + 1)
    expect(container.textContent).toContain("Lignes de bus")
    expect(container.textContent).toContain("Abonnés actifs")
    expect(container.textContent).toContain("Arrêts enregistrés")
  })

  it("alerte en criticité quand aucune ligne n'est configurée", () => {
    renderView(
      <TransportView routes={[]} subs={[]} enrollments={[makeEnrollment()]} {...handlers} />,
    )

    expect(container.querySelector('[data-testid="guidance"]')!.textContent)
      .toContain("Aucune ligne de transport n’est configurée")
  })

  it("signale l'absence d'inscriptions élèves quand des lignes existent", () => {
    renderView(
      <TransportView routes={[makeBusRoute()]} subs={[]} enrollments={[]} {...handlers} />,
    )

    expect(container.querySelector('[data-testid="guidance"]')!.textContent)
      .toContain("Aucune inscription élève disponible")
  })

  it("invite le premier abonnement quand une ligne et des élèves sont prêts", () => {
    renderView(
      <TransportView
        routes={[makeBusRoute()]}
        subs={[]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    expect(container.querySelector('[data-testid="guidance"]')!.textContent)
      .toContain("Le transport est prêt à recevoir son premier abonnement")
  })

  it("prévient quand la capacité d'une ligne est atteinte", () => {
    renderView(
      <TransportView
        routes={[makeBusRoute({ capacity: 1 })]}
        subs={[makeTransportSub({}), makeTransportSub({ id: "t2", bus_routes: null })]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    expect(container.querySelector('[data-testid="guidance"]')!.textContent)
      .toContain("Une capacité de transport semble atteinte")
  })

  it("affiche chaque ligne avec statut, chauffeur, plaque, places et frais", () => {
    renderView(
      <TransportView
        routes={[
          makeBusRoute({
            driver_name: "Konan Yao",
            vehicle_plate: "AB 1234 CI",
            capacity: 40,
            monthly_fee_cfa: 15_000,
          }),
          makeBusRoute({ id: "r2", name: "Ligne Sud", is_active: false }),
        ]}
        subs={[]}
        enrollments={[]}
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Ligne Nord – Abobo")
    expect(text).toContain("Active")
    expect(text).toContain("Konan Yao")
    expect(text).toContain("AB 1234 CI")
    expect(text).toContain("40 places")
    expect(text).toContain(`${(15_000).toLocaleString("fr-FR")} FCFA`)
    expect(text).toContain("Inactive")
  })

  it("affiche les états vides et désactive l'abonnement sans ligne", () => {
    renderView(
      <TransportView routes={[]} subs={[]} enrollments={[]} {...handlers} />,
    )

    expect(container.textContent).toContain("Aucune ligne configurée.")
    expect(container.textContent).toContain("Aucun abonnement enregistré.")
    const subButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Nouvel abonnement"),
    )
    expect(subButton!.disabled).toBe(true)
  })

  it("affiche la table des abonnements : élève, ligne, arrêt, statut", () => {
    renderView(
      <TransportView
        routes={[makeBusRoute()]}
        subs={[
          makeTransportSub({
            start_date: "2026-01-15",
            bus_stops: { id: "s1", name: "Cocody" },
          }),
        ]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Kouadio Aya")
    expect(text).toContain("6e B")
    expect(text).toContain("Ligne Nord – Abobo")
    expect(text).toContain("Cocody")
    expect(text).toContain("15/01/2026")
    expect(text).toContain("Actif")
  })

  it("affiche le formulaire de ligne après clic et le referme après création réussie", async () => {
    renderView(
      <TransportView routes={[]} subs={[]} enrollments={[]} {...handlers} />,
    )

    const routeButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Nouvelle ligne"),
    )!
    act(() => { routeButton.click() })
    expect(container.querySelector("#tr-name")).not.toBeNull()

    act(() => {
      container
        .querySelector('[data-testid="action-form"]')!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    expect(handlers.onCreateRoute).toHaveBeenCalledTimes(1)
    expect(container.querySelector("#tr-name")).toBeNull()
  })

  it("propose les arrêts de la ligne choisie dans le formulaire d'abonnement", () => {
    renderView(
      <TransportView
        routes={[
          makeBusRoute({ bus_stops: [{ id: "s1", name: "Cocody", pickup_time: "07:10" }] }),
        ]}
        subs={[]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    const subButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Nouvel abonnement"),
    )!
    act(() => { subButton.click() })

    const routeSelect = container.querySelector<HTMLSelectElement>("#sub-route")!
    act(() => {
      routeSelect.value = "r1"
      routeSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })

    const stopSelect = container.querySelector<HTMLSelectElement>("#sub-stop")!
    expect(stopSelect).not.toBeNull()
    expect(stopSelect.textContent).toContain("Cocody (07:10)")
  })
})
