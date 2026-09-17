// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  options: vi.fn<() => ReturnType<typeof import("./actions").getImportOptions>>(async () => ({ data: {
    classes: [{ id: "11111111-1111-1111-1111-111111111111", label: "6e A" }],
    years: [{ id: "22222222-2222-2222-2222-222222222222", label: "2025-2026" }],
  } })),
  importMovement: vi.fn<(form: FormData) => ReturnType<typeof import("./actions").importMovement>>(async () => ({
    data: { enrollmentId: "33333333-3333-3333-3333-333333333333" },
  })),
}))
vi.mock("./actions", () => ({
  getImportOptions: mocks.options, importMovement: mocks.importMovement,
}))
// `use server` n'existe pas hors Next : les actions sont déjà simulées ci-dessus.
import ImportMovementPage from "./page"

let container: HTMLDivElement
let root: Root
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.options.mockClear(); mocks.importMovement.mockClear()
  container = document.createElement("div"); document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(await ImportMovementPage()) })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

/** Saisie React : l'assignation directe de `value` n'atteint pas le state. */
function typeCode(code: string) {
  const field = container.querySelector<HTMLInputElement>('[name="trackingCode"]')!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, code)
  field.dispatchEvent(new Event("input", { bubbles: true }))
}

it("annonce qu’aucun dossier n’est consultable avant l’importation", () => {
  expect(container.textContent).toContain("n’est pas consultable avant l’importation")
})

it("signale une incomplétude puis un code invalide sans requête serveur", async () => {
  await act(async () => { typeCode("TRF012") })
  expect(container.textContent).toContain("Code incomplet (6/8)")
  await act(async () => { typeCode("TRF0123D") })
  expect(container.textContent).toContain("Code invalide : vérifiez la saisie.")
  expect(mocks.importMovement).not.toHaveBeenCalled()
})

it("reconnaît un transfert privé valide sans promettre un succès serveur", async () => {
  await act(async () => { typeCode("TRF0123E") })
  expect(container.textContent).toContain("Transfert privé — code reconnu, en attente du contrôle serveur.")
  expect(container.textContent).not.toContain("Importation enregistrée")
})

it("identifie une orientation officielle et bloque l’import", async () => {
  const orientation = "ORT0123" + calculateChecksum("ORT0123")
  await act(async () => { typeCode(orientation) })
  expect(container.textContent).toContain("Affecté par l’État")
  expect(container.textContent).toContain("import non disponible")
  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
  expect(submit.disabled).toBe(true)
})

it("transmet le code normalisé et affiche l’inscription créée", async () => {
  await act(async () => { typeCode(" trf-0123 e ") })
  const form = container.querySelector("form")!
  form.querySelector<HTMLSelectElement>('[name="classId"]')!.value = "11111111-1111-1111-1111-111111111111"
  form.querySelector<HTMLSelectElement>('[name="academicYearId"]')!.value = "22222222-2222-2222-2222-222222222222"
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(mocks.importMovement).toHaveBeenCalledTimes(1)
  const submitted = mocks.importMovement.mock.calls[0] as unknown as [FormData]
  expect(submitted[0].get("trackingCode")).toBe("TRF0123E")
  expect(container.textContent).toContain("Importation enregistrée")
  expect(container.textContent).toContain("33333333-3333-3333-3333-333333333333")
})

it("affiche un refus serveur sans annoncer une importation réussie", async () => {
  mocks.importMovement.mockResolvedValueOnce({ error: "Établissement d'accueil non autorisé par la direction source." })
  await act(async () => { typeCode("TRF0123E") })
  const form = container.querySelector("form")!
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(container.textContent).toContain("non autorisé par la direction source")
  expect(container.textContent).not.toContain("Importation enregistrée")
})

it("signale une installation manquante sans exposer le détail technique", async () => {
  mocks.options.mockResolvedValueOnce({ error: "L’import par transfert n’est pas encore installé sur cette base. Contactez l’administrateur." })
  await act(async () => { root.render(await ImportMovementPage()) })
  expect(container.textContent).toContain("pas encore installé")
  expect(container.querySelector("form")).toBeNull()
})

/** Réplique de `movementCodeChecksum` pour construire le vecteur ORT du test. */
function calculateChecksum(body: string) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
  let total = body.charCodeAt(0) + 3 * body.charCodeAt(1) + 5 * body.charCodeAt(2)
  for (let position = 4; position <= 7; position++) {
    total += alphabet.indexOf(body[position - 1]!) * (2 * position - 1)
  }
  return alphabet[total % 32]!
}