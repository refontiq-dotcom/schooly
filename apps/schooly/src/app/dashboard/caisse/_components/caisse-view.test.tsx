// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => ({
  Search: () => null,
  ShieldCheck: () => null,
  Wallet: () => null,
  Receipt: () => null,
}))

// Les modales (radix + server actions) sont hors périmètre de ces tests :
// on rend leurs boutons pour vérifier la logique de session, pas le radix.
vi.mock("../open-session-modal", () => ({
  OpenSessionModal: () => <button type="button">Ouvrir une session</button>,
}))
vi.mock("../pay-modal", () => ({
  PayModal: () => <button type="button">Encaisser</button>,
}))

import { CaisseView } from "./caisse-view"
import {
  makeBalanceInfo,
  makeCaisseEnrollment,
  makeCaissePayment,
  makeCashSession,
} from "../_lib/test-fixtures"
import {
  defaultAmountFor,
  filterEnrollments,
  paymentsForDay,
  totalOf,
} from "../_lib/helpers"
import { normalizeEnrollments, normalizePayments } from "../_lib/types"

const TODAY = "2026-09-20"

type ViewProps = React.ComponentProps<typeof CaisseView>

function renderView(props: Partial<ViewProps> = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <CaisseView
        enrollments={[]}
        payments={[]}
        session={null}
        balanceByEnrollment={{}}
        today={TODAY}
        onRefresh={() => {}}
        {...props}
      />,
    )
  })
  return { container, root }
}

describe("CaisseView", () => {
  let root: Root | null = null

  beforeEach(() => {
    root = null
  })

  afterEach(() => {
    if (root) act(() => root!.unmount())
    document.body.innerHTML = ""
  })

  it("affiche l'invitation à ouvrir une session quand aucune session n'est ouverte", () => {
    const view = renderView({ session: null })
    root = view.root
    expect(view.container.textContent).toContain("Ouvrir une session")
  })

  it("masque l'invitation quand une session est ouverte", () => {
    const view = renderView({ session: makeCashSession() })
    root = view.root
    expect(view.container.textContent).not.toContain("Ouvrir une session")
  })

  it("affiche le total et le nombre de transactions du jour uniquement", () => {
    const view = renderView({
      payments: [
        makeCaissePayment({ id: "p1", amount: 10000, received_at: `${TODAY}T09:00:00.000Z` }),
        makeCaissePayment({ id: "p2", amount: 5000, received_at: `${TODAY}T14:00:00.000Z` }),
        makeCaissePayment({ id: "p3", amount: 99999, received_at: "2026-09-19T09:00:00.000Z" }),
      ],
    })
    root = view.root
    expect(view.container.textContent).toContain((15000).toLocaleString("fr-FR"))
    expect(view.container.textContent).toContain("2 transaction(s)")
  })

  it("filtre la liste des élèves par recherche (nom, prénom, matricule)", () => {
    const view = renderView({
      enrollments: [
        makeCaisseEnrollment(),
        makeCaisseEnrollment({
          id: "enr-2",
          matricule: "MAT-002",
          students: { first_name: "Issa", last_name: "Diallo" },
        }),
      ],
    })
    root = view.root
    expect(view.container.textContent).toContain("Awa")
    expect(view.container.textContent).toContain("Issa")

    const input = view.container.querySelector("input[type='search']") as HTMLInputElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "diallo")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(view.container.textContent).toContain("Issa")
    expect(view.container.textContent).not.toContain("Awa")
  })

  it("affiche l'état vide quand la recherche ne correspond à rien", () => {
    const view = renderView({ enrollments: [makeCaisseEnrollment()] })
    root = view.root
    const input = view.container.querySelector("input[type='search']") as HTMLInputElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "zzzz")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(view.container.textContent).toContain("Aucun élève ne correspond à cette recherche.")
  })

  it("affiche « Reste à payer » pour un élève avec solde et échéancier", () => {
    const view = renderView({
      enrollments: [makeCaisseEnrollment()],
      balanceByEnrollment: { "enr-1": makeBalanceInfo({ balance: 25000 }) },
    })
    root = view.root
    expect(view.container.textContent).toContain("Reste à payer")
    expect(view.container.textContent).toContain((25000).toLocaleString("fr-FR"))
  })

  it("affiche « Solde soldé » quand le solde est à zéro", () => {
    const view = renderView({
      enrollments: [makeCaisseEnrollment()],
      balanceByEnrollment: { "enr-1": makeBalanceInfo({ balance: 0 }) },
    })
    root = view.root
    expect(view.container.textContent).toContain("Solde soldé")
  })

  it("n'affiche aucune mention de solde pour un élève sans échéancier", () => {
    const view = renderView({
      enrollments: [makeCaisseEnrollment()],
      balanceByEnrollment: { "enr-1": makeBalanceInfo({ hasFeeItems: false }) },
    })
    root = view.root
    expect(view.container.textContent).not.toContain("Reste à payer")
    expect(view.container.textContent).not.toContain("Solde soldé")
  })

  it("liste au plus 5 derniers encaissements, ou l'état vide", () => {
    const empty = renderView({ payments: [] })
    expect(empty.container.textContent).toContain("Aucun encaissement.")
    act(() => empty.root.unmount())

    const payments = Array.from({ length: 7 }, (_, i) =>
      makeCaissePayment({ id: `p${i}`, amount: 1000 * (i + 1) }),
    )
    const view = renderView({ payments })
    root = view.root
    expect(view.container.textContent).toContain("Derniers encaissements")
    const rows = view.container.querySelectorAll("[data-recent-payment]")
    expect(rows.length).toBe(5)
  })
})

describe("helpers caisse", () => {
  it("filterEnrollments filtre par nom insensible à la casse", () => {
    const list = [makeCaisseEnrollment()]
    expect(filterEnrollments(list, "KONÉ")).toHaveLength(1)
    expect(filterEnrollments(list, "  koné ")).toHaveLength(1)
    expect(filterEnrollments(list, "inconnu")).toHaveLength(0)
    expect(filterEnrollments(list, "")).toHaveLength(1)
  })

  it("paymentsForDay isole les paiements du jour", () => {
    const payments = [
      makeCaissePayment({ id: "a", received_at: `${TODAY}T08:00:00.000Z` }),
      makeCaissePayment({ id: "b", received_at: "2026-09-19T23:59:00.000Z" }),
    ]
    expect(paymentsForDay(payments, TODAY).map((p) => p.id)).toEqual(["a"])
  })

  it("totalOf additionne les montants", () => {
    expect(
      totalOf([makeCaissePayment({ amount: 100 }), makeCaissePayment({ amount: 250 })]),
    ).toBe(350)
    expect(totalOf([])).toBe(0)
  })

  it("defaultAmountFor préremplit l'échéance, sinon le solde, sinon vide", () => {
    expect(defaultAmountFor(25000, makeBalanceInfo())).toBe("25000")
    expect(defaultAmountFor(30000, makeBalanceInfo({ nextDueAmount: 12000 }))).toBe("12000")
    expect(defaultAmountFor(0, makeBalanceInfo({ nextDueAmount: null }))).toBe("")
    expect(defaultAmountFor(42000)).toBe("42000")
    expect(defaultAmountFor(0)).toBe("")
  })
})

describe("normalisation frontière caisse", () => {
  it("normalizeEnrollments écarte les lignes invalides sans cast aveugle", () => {
    const rows = [
      {
        id: "ok",
        matricule: "M1",
        students: { first_name: "A", last_name: "B" },
        guardians: { full_name: "G", phone: "1" },
        grade_levels: { name: "6e" },
      },
      { id: "sans-etudiants", students: null },
      "pas-un-objet",
      null,
    ]
    const result = normalizeEnrollments(rows)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("ok")
    expect(normalizeEnrollments("nawak")).toEqual([])
  })

  it("normalizePayments écarte les montants non finis", () => {
    const rows = [
      {
        id: "ok",
        amount: 15000,
        payment_method: "cash",
        reference: null,
        received_at: "2026-09-20T09:00:00Z",
        enrollments: null,
      },
      { id: "montant-corrompu", amount: "15000" },
      { amount: 1 },
    ]
    const result = normalizePayments(rows)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(15000)
    expect(normalizePayments(undefined)).toEqual([])
  })
})
