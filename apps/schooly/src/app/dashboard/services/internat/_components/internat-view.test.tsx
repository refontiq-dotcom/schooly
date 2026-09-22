// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Building2: () => null,
  BedDouble: () => null,
  Users: () => null,
  Plus: () => null,
}))

// Le formulaire d'action est remplacé par une balise form simple : le test
// porte sur la composition et les callbacks, pas sur son rendu interne.
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

import { InternatView } from "./internat-view"
import { makeDormitory, makeEnrollment, makeRoom, makeSub } from "../../_lib/test-fixtures"

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
  onCreateDormitory: vi.fn(async () => ({ ok: true })),
  onCreateRoom: vi.fn(async () => ({ ok: true })),
  onCreateSub: vi.fn(async () => ({ ok: true })),
}

beforeEach(() => {
  for (const fn of Object.values(handlers)) fn.mockClear()
})

describe("InternatView — composition", () => {
  it("affiche les 3 stats : dortoirs, chambres, internes actifs", () => {
    const dormitories = [
      makeDormitory({ dorm_rooms: [makeRoom({}), makeRoom({ id: "r2" })] }),
      makeDormitory({ id: "d2", name: "Pavillon Sud", dorm_rooms: [] }),
    ]
    renderView(
      <InternatView
        dormitories={dormitories}
        subs={[makeSub({ status: "active" }), makeSub({ id: "s2", status: "cancelled" })]}
        enrollments={[]}
        {...handlers}
      />,
    )

    expect(container.textContent).toContain("Dortoirs")
    expect(container.textContent).toContain("Chambres")
    expect(container.textContent).toContain("Internes actifs")
    // 2 dortoirs, 2 chambres, 1 interne actif sur 2 abonnements
    expect(container.querySelectorAll(".text-3xl")[0].textContent).toBe("2")
    expect(container.querySelectorAll(".text-3xl")[1].textContent).toBe("2")
    expect(container.querySelectorAll(".text-3xl")[2].textContent).toBe("1")
  })

  it("affiche chaque dortoir avec genre, capacité, responsable et ses chambres", () => {
    renderView(
      <InternatView
        dormitories={[
          makeDormitory({
            gender_restriction: "female",
            supervisor_name: "Mme Dia",
            dorm_rooms: [makeRoom({ room_number: "101", capacity: 4 })],
          }),
        ]}
        subs={[]}
        enrollments={[]}
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Pavillon Nord")
    expect(text).toContain("Filles")
    expect(text).toContain("60 places")
    expect(text).toContain("Mme Dia")
    expect(text).toContain("Ch. 101 (4 lits)")
  })

  it("affiche l'état vide quand aucun dortoir n'est configuré", () => {
    renderView(
      <InternatView dormitories={[]} subs={[]} enrollments={[]} {...handlers} />,
    )

    expect(container.textContent).toContain("Aucun dortoir configuré.")
  })

  it("affiche la table des internes : élève, chambre, frais, statut", () => {
    renderView(
      <InternatView
        dormitories={[makeDormitory()]}
        subs={[
          makeSub({
            dorm_rooms: { room_number: "101", dormitories: { name: "Pavillon Nord" } },
            status: "active",
            amount_cfa: 50_000,
            start_date: "2026-01-15",
          }),
        ]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Kouadio Aya")
    expect(text).toContain("6e B")
    expect(text).toContain("Pavillon Nord — Ch. 101")
    expect(text).toContain("50\u202f000 FCFA")
    expect(text).toContain("Actif")
    expect(text).toContain("15/01/2026")
  })

  it("affiche l'état vide des affectations et masque le formulaire sans dortoir", () => {
    renderView(
      <InternatView dormitories={[]} subs={[]} enrollments={[]} {...handlers} />,
    )

    expect(container.textContent).toContain("Aucun élève interne enregistré.")
    // Le bouton d'affectation est désactivé sans dortoir (comportement existant).
    const assign = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Affecter un élève"),
    )
    expect(assign).toBeDefined()
    expect(assign!.disabled).toBe(true)
  })

  it("affiche le formulaire de dortoir après clic et le referme après création réussie", async () => {
    renderView(
      <InternatView
        dormitories={[]}
        subs={[]}
        enrollments={[makeEnrollment()]}
        {...handlers}
      />,
    )

    const dormButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Nouveau dortoir"),
    )!
    act(() => { dormButton.click() })
    expect(container.querySelector("#dorm-name")).not.toBeNull()

    act(() => {
      container
        .querySelector('[data-testid="action-form"]')!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    expect(handlers.onCreateDormitory).toHaveBeenCalledTimes(1)
    // Panneau refermé après succès
    expect(container.querySelector("#dorm-name")).toBeNull()
  })
})
