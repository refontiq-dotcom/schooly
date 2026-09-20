// @vitest-environment jsdom
// apps/schooly/src/app/dashboard/pedagogie/grades/report-cards/page.test.tsx
// Page « Bulletins » : aperçu annuel, décision officielle, génération et
// publication — réservée à la direction. La saisie de notes n'y a plus sa place.
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: { role: "direction" } as { role?: string } | null,
  annual: vi.fn(),
  // Signature explicite : `mock.calls[0][0]` reste typé `FormData`, ce qui
  // permet de vérifier les champs transmis sans cast non sûr.
  generate: vi.fn<(form: FormData) => Promise<{ error?: string }>>(async () => ({})),
  publish: vi.fn<(form: FormData) => Promise<{ error?: string }>>(async () => ({})),
  validate: vi.fn<(form: FormData) => Promise<{ error?: string }>>(async () => ({})),
}))

const ANNUAL_ROW = {
  enrollmentId: "e",
  name: "Élève A",
  average: 12.5,
  proposal: "admitted" as const,
  allPeriodsClosed: true,
  readyForValidation: true,
  blockers: [],
  fingerprint: "fp-1",
}

vi.mock("@/hooks/use-supabase-user", () => ({ useSupabaseUser: () => mocks.user }))
vi.mock("../../actions", () => ({
  getAcademicYearsForSchool: async () => ({ data: [{ id: "y", label: "2026" }] }),
  getClassesForSchool: async () => ({ data: [{ id: "c", name: "CM2" }] }),
}))
vi.mock("../../evaluation-actions", () => ({
  getAnnualPreview: mocks.annual,
  validateAnnualDecision: mocks.validate,
  generateReportCards: mocks.generate,
  publishReportCards: mocks.publish,
}))
// Le lockfile installe deux copies de react (racine / app) : les icônes de
// lucide-react résolvent la mauvaise et cassent le rendu du test.
vi.mock("lucide-react", () => ({ ArrowLeft: () => null }))

import ReportCardsPage from "./page"

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.user = { role: "direction" }
  mocks.annual.mockReset()
  mocks.annual.mockResolvedValue({ data: [ANNUAL_ROW] })
  mocks.generate.mockClear()
  mocks.publish.mockClear()
  mocks.validate.mockClear()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<ReportCardsPage />) })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

// ActionForm ne pose pas d'attribut `action` (l'action est une fonction React) :
// on repère chaque formulaire par le libellé de son bouton, comme un utilisateur.
function formOf(buttonLabel: string): HTMLFormElement {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === buttonLabel,
  )
  if (!button) throw new Error(`Bouton « ${buttonLabel} » introuvable`)
  return button.closest("form")!
}

async function submit(buttonLabel: string) {
  const form = formOf(buttonLabel)
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  })
  await act(async () => {})
  return form
}

async function renderAs(role: string | null) {
  mocks.user = role === null ? null : { role }
  await act(async () => { root.render(<ReportCardsPage />) })
  await act(async () => {})
}

function previewForm() {
  const form = formOf("Calculer l’année")
  form.querySelector<HTMLSelectElement>('[name="classId"]')!.value = "c"
  form.querySelector<HTMLSelectElement>('[name="academicYearId"]')!.value = "y"
  return form
}

// Les formulaires de génération et de publication transmettent la classe et
// l'année choisies : on les renseigne avant de soumettre, comme le ferait un
// utilisateur (un nom de champ erroné ferait un no-op silencieux côté serveur).
function fillContext(buttonLabel: string) {
  const form = formOf(buttonLabel)
  form.querySelector<HTMLSelectElement>('[name="classId"]')!.value = "c"
  form.querySelector<HTMLSelectElement>('[name="yearId"]')!.value = "y"
  return form
}

// --- Périmètre : la saisie de notes n'est plus ici --------------------------

it("n’expose plus la saisie de note", () => {
  expect(container.querySelector('select[name="assessmentId"]')).toBeNull()
  expect(container.querySelector('select[name="absenceStatus"]')).toBeNull()
})

// --- Aperçu annuel et décision officielle (§6) -----------------------------

it("calcule l’année puis propose la décision officielle", async () => {
  previewForm()
  await submit("Calculer l’année")

  expect(mocks.annual).toHaveBeenCalledWith("c", "y")
  expect(container.textContent).toContain("Élève A")
  expect(container.textContent).toContain("décision proposée : admis")
  expect(container.textContent).toContain("prêt à valider")
  expect(container.querySelector('select[name="decision"]')).not.toBeNull()
})

it("rejoue l’aperçu après la validation d’une décision", async () => {
  previewForm()
  await submit("Calculer l’année")
  expect(mocks.annual).toHaveBeenCalledTimes(1)

  await submit("Valider et figer le résultat")

  expect(mocks.validate).toHaveBeenCalledTimes(1)
  expect(mocks.annual).toHaveBeenCalledTimes(2) // l'état affiché suit l'écriture
  expect(container.textContent).toContain("Décision figée par le serveur")
})

it("transmet l’empreinte serveur lors de la validation", async () => {
  previewForm()
  await submit("Calculer l’année")
  const form = await submit("Valider et figer le résultat")

  const sent = form.querySelector<HTMLInputElement>('[name="fingerprint"]')!.value
  expect(sent).toBe("fp-1")
})

// --- Bulletins (§7) --------------------------------------------------------

it("génère puis publie les bulletins depuis la même page", async () => {
  fillContext("Générer les bulletins")
  await submit("Générer les bulletins")
  fillContext("Publier aux familles")
  await submit("Publier aux familles")

  expect(mocks.generate).toHaveBeenCalledTimes(1)
  expect(mocks.publish).toHaveBeenCalledTimes(1)
  // `mock.calls[0][0]` est typé FormData grâce à la signature du mock : on peut
  // vérifier les champs réellement transmis sans cast non sûr.
  const generated = mocks.generate.mock.calls[0][0]
  const published = mocks.publish.mock.calls[0][0]
  expect(generated.get("classId")).toBe("c")
  expect(generated.get("yearId")).toBe("y")
  expect(published.get("classId")).toBe("c")
})

it("avertit que la publication est irréversible", () => {
  expect(container.textContent).toContain("immuable")
})

// --- Garde d'accès ---------------------------------------------------------

it("refuse l’accès aux rôles non direction", async () => {
  await renderAs("professeur")
  expect(container.textContent).toContain("réservée à la direction")
  expect(container.querySelector("form")).toBeNull()
  expect(container.textContent).not.toContain("Calculer l’année")
})

it("n’affiche rien tant que la session n’est pas connue", async () => {
  await renderAs(null)
  expect(container.textContent).toBe("")
})
