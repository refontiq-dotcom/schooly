// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activations: vi.fn<() => ReturnType<typeof import("./actions").getMovementActivations>>(async () => ({ canActivate: true, data: [] })),
  activate: vi.fn<(form: FormData) => ReturnType<typeof import("./actions").activateMovement>>(async () => ({ data: {
    tracking_code: "TRF12345", status: "ACTIVE", expires_at: "2099-11-16T09:00:00Z",
  } })),
  save: vi.fn(async () => ({})),
  overview: vi.fn<() => ReturnType<typeof import("./actions").getMovementOverview>>(async () => ({ data: {
    enrollments: [{ id: "e1", label: "KOFFI Awa — 2025-2026 — CM2 A", matricule: "MENA-1" }],
    requests: [],
  } })),
}))
vi.mock("./actions", () => ({
  getMovementOverview: mocks.overview, prepareMovement: mocks.save,
  getMovementActivations: mocks.activations, activateMovement: mocks.activate,
}))
import MovementsPage from "./page"

let container: HTMLDivElement
let root: Root
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.save.mockClear(); mocks.overview.mockClear(); mocks.activate.mockClear(); mocks.activations.mockClear()
  container = document.createElement("div"); document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(await MovementsPage()) })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it("masque les inscriptions déjà couvertes par une demande", async () => {
  const options = container.querySelectorAll<HTMLSelectElement>('select[name="enrollmentId"] option')
  expect(options).toHaveLength(2) // option vide + la seule inscription disponible
  expect(options[1]!.textContent).toContain("KOFFI Awa")
})

it("affiche les demandes enregistrées avec leur inscription d'origine", async () => {
  mocks.overview.mockResolvedValueOnce({ data: {
    enrollments: [{ id: "e1", label: "KOFFI Awa — 2025 — CM2 A", matricule: "MENA-1" }],
    requests: [{ id: "r1", enrollment_id: "e1", kind: "ORT", reason: "Orientation DREN", decision_reference: "DEC-99", tracking_code: "ORT12345", created_at: "2026-09-17T09:00:00Z" }],
  } })
  await act(async () => { root.render(await MovementsPage()) })
  expect(container.textContent).toContain("Orientation DREN")
  expect(container.textContent).toContain("DEC-99")
  expect(container.textContent).toContain("ORT12345")
  expect(container.textContent).toContain("non utilisable pour une inscription d’accueil")
  expect(container.querySelector('select[name="enrollmentId"]')).toBeNull()
})

it("prépare TRF sans champs administratifs puis transmet le motif", async () => {
  const form = container.querySelector("form")!
  expect(form.querySelector('[name="decisionReference"]')).toBeNull()
  form.querySelector<HTMLSelectElement>('[name="enrollmentId"]')!.value = "e1"
  form.querySelector<HTMLInputElement>('[name="reason"]')!.value = "Déménagement familial"
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(mocks.save).toHaveBeenCalledTimes(1)
  const submitted = mocks.save.mock.calls[0] as unknown as [FormData]
  expect(submitted[0].get("kind")).toBe("TRF")
  expect(submitted[0].get("reason")).toBe("Déménagement familial")
})

it("demande les références administratives uniquement pour ORT", async () => {
  mocks.overview.mockResolvedValueOnce({ data: {
    enrollments: [{ id: "e1", label: "KOFFI Awa — 2025 — CM2 A", matricule: "MENA-1" }],
    requests: [],
  } })
  await act(async () => { root.render(await MovementsPage()) })
  const form = container.querySelector("form")!
  const kind = form.querySelector<HTMLSelectElement>('[name="kind"]')!
  expect(form.querySelector('[name="decisionReference"]')).toBeNull()
  await act(async () => { kind.value = "ORT"; kind.dispatchEvent(new Event("change", { bubbles: true })) })
  expect(form.querySelector('[name="decisionReference"]')).not.toBeNull()
  expect(form.querySelector('[name="scholarshipStatus"]')).not.toBeNull()
})

it("signale quand la table n'est pas encore installée", async () => {
  mocks.overview.mockResolvedValueOnce({ error: "La préparation TRF/ORT n’est pas encore installée sur cette base. Contactez l’administrateur." })
  await act(async () => { root.render(await MovementsPage()) })
  expect(container.textContent).toContain("pas encore installée")
})

async function renderRequest(kind: "TRF" | "ORT" = "TRF") {
  mocks.overview.mockResolvedValueOnce({ data: {
    enrollments: [{ id: "e1", label: "KOFFI Awa", matricule: "MENA-1" }],
    requests: [{ id: "r1", enrollment_id: "e1", kind, reason: "Départ familial",
      decision_reference: null, tracking_code: `${kind}12345`, created_at: "2026-09-17T09:00:00Z" }],
  } })
  await act(async () => { root.render(await MovementsPage()) })
}

it("active TRF et affiche le résultat sans promettre une importation", async () => {
  await renderRequest()
  const form = container.querySelector("form")!
  expect(form.textContent).toContain("Activer TRF pour 60 jours")
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(mocks.activate).toHaveBeenCalledTimes(1)
  expect(mocks.activate.mock.calls[0]![0].get("requestId")).toBe("r1")
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Activation administrative enregistrée")
  expect(container.textContent).toContain("Aucun quitus ni droit d’importation accordé")
  expect(container.querySelector("form")).toBeNull()
})

it.each([
  ["2099-11-16T09:00:00Z", "Activation administrative active"],
  ["2000-11-16T09:00:00Z", "Activation expirée"],
])("affiche l’échéance %s sans proposer une nouvelle activation", async (expiresAt, label) => {
  mocks.activations.mockResolvedValueOnce({ canActivate: true, data: [{
    request_id: "r1", activated_at: "2000-09-17T09:00:00Z", expires_at: expiresAt,
    expired: new Date(expiresAt).getTime() <= Date.now(),
  }] })
  await renderRequest()
  expect(container.textContent).toContain(label)
  expect(container.querySelector("form")).toBeNull()
})

it("ne propose aucune activation ORT", async () => {
  await renderRequest("ORT")
  expect(container.textContent).toContain("Orientation à vérifier")
  expect(container.querySelector("form")).toBeNull()
})

it("ne présente pas au secrétariat une activation invisible comme non activée", async () => {
  mocks.activations.mockResolvedValueOnce({ canActivate: false })
  await renderRequest()
  expect(container.textContent).toContain("État d’activation réservé à la direction ou indisponible")
  expect(container.textContent).not.toContain("Brouillon non activé")
  expect(container.querySelector("form")).toBeNull()
})

it("affiche un refus serveur sans annoncer une activation réussie", async () => {
  mocks.activate.mockResolvedValueOnce({ error: "Activation refusée." })
  await renderRequest()
  const form = container.querySelector("form")!
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(container.textContent).toContain("Activation refusée.")
  expect(container.textContent).not.toContain("Activation administrative enregistrée")
})


