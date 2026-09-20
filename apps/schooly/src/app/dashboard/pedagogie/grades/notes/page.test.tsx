// @vitest-environment jsdom
// apps/schooly/src/app/dashboard/pedagogie/grades/notes/page.test.tsx
// Page « Notes » : saisie + suivi uniquement. Les bulletins et la décision
// annuelle vivent dans report-cards — l'onglet par défaut est la saisie.
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  user: { role: "direction" } as { role?: string } | null,
  // Signature explicite : `mock.calls[0][0]` reste typé `FormData`, ce qui
  // permet de vérifier les champs transmis sans cast non sûr.
  save: vi.fn<(form: FormData) => Promise<{ error?: string }>>(async () => ({})),
  results: vi.fn(async () => ({ data: [{ enrollmentId: "e", name: "Élève A", average: 13, coverage: "2/2", scale: 20, complete: true, expected: 4, entered: 4, unlinked: 0 }] })),
}))

vi.mock("@/hooks/use-supabase-user", () => ({ useSupabaseUser: () => mocks.user }))
vi.mock("../../actions", () => ({
  createGradeEntry: mocks.save,
  getGradeEntries: async () => ({ data: [{ id: "g", value: null, absence_status: "excused", label: "DS1", weight: 1, period_id: "p" }] }),
  getAcademicYearsForSchool: async () => ({ data: [{ id: "y", label: "2026" }] }),
  getEnrollmentsForSchool: async () => ({ data: [{ id: "e", students: { last_name: "Élève", first_name: "A" }, classes: { name: "CM2" } }] }),
  getSubjectsForSchool: async () => ({ data: [{ id: "s", name: "Maths" }] }),
  getClassesForSchool: async () => ({ data: [{ id: "c", name: "CM2" }] }),
}))
vi.mock("../../evaluation-actions", () => ({
  getEvaluationConfiguration: async () => ({ data: {
    rules: [{ id: "r", academic_year_id: "y", mode: "TRIMESTRE", cycle: "*", scale: 20, threshold: 10, rescue_margin: 0, interrogation_percent: null }],
    periods: [{ id: "p", rule_id: "r", label: "T1", locked_at: null, starts_at: "2026-09-01", ends_at: "2026-12-01" }],
  } }),
  getEvaluationAssessments: async () => ({ data: [{ id: "a", period_id: "p", class_id: "c", subject_id: "s", grade_type: "devoir", label: "DS1", max_value: 40, weight: 1 }] }),
  createEvaluationAssessment: mocks.save,
  createEvaluationRule: async () => ({}),
  createEvaluationPeriod: async () => ({}),
  closeEvaluationPeriod: async () => ({}),
  getPeriodResults: mocks.results,
}))
vi.mock("../../grade-correction-panel", () => ({
  GradeCorrectionPanel: () => <span>Correction</span>,
}))

import NotesPage from "./page"

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  mocks.user = { role: "direction" }
  mocks.save.mockClear()
  mocks.results.mockClear()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(<NotesPage />) })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function clickTab(label: string) {
  const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) =>
    t.textContent?.includes(label),
  )!
  await act(async () => tab.dispatchEvent(new MouseEvent("click", { bubbles: true })))
}

function tabLabels() {
  return [...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent ?? "")
}

// --- Saisie (onglet par défaut) ---------------------------------------------

it("ouvre sur la saisie de note, sans exposer la configuration", () => {
  expect(container.querySelector('select[name="assessmentId"]')).not.toBeNull()
  expect(container.querySelector('select[name="absenceStatus"]')).not.toBeNull()
  expect(container.querySelector('[name="rescueMargin"]')).toBeNull()
})

it("affiche ABS et désactive la note numérique pour une absence", async () => {
  expect(container.textContent).toContain("DS1 : ABS")
  const select = container.querySelector<HTMLSelectElement>('select[name="absenceStatus"]')!
  await act(async () => { select.value = "excused"; select.dispatchEvent(new Event("change", { bubbles: true })) })
  expect(container.querySelector<HTMLInputElement>('input[name="value"]')!.disabled).toBe(true)
})

it("envoie l’évaluation choisie sans barème ni poids modifiables", async () => {
  const select = container.querySelector<HTMLSelectElement>('select[name="assessmentId"]')!
  const form = select.closest("form")!
  expect(form.querySelector('[name="maxValue"]')).toBeNull()
  expect(form.querySelector('[name="weight"]')).toBeNull()
  select.value = "a"
  form.querySelector<HTMLSelectElement>('[name="enrollmentId"]')!.value = "e"
  form.querySelector<HTMLInputElement>('[name="value"]')!.value = "30"
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(mocks.save).toHaveBeenCalledTimes(1)
  const submitted = mocks.save.mock.calls[0][0] // FormData, typé par la signature du mock
  expect(submitted.get("assessmentId")).toBe("a")
  expect(submitted.get("value")).toBe("30")
})

// --- Onglets : divulgation progressive -------------------------------------

it("place la configuration des règles dans un onglet dédié", async () => {
  expect(container.querySelector('[name="rescueMargin"]')).toBeNull()
  await clickTab("Configuration")
  expect(container.querySelector('[name="rescueMargin"]')).not.toBeNull()
  expect(container.querySelector('[name="scale"]')).not.toBeNull()
})

it("regroupe l’historique et les corrections dans le dernier onglet", async () => {
  expect(container.textContent).not.toContain("Historique autorisé")
  await clickTab("Historique")
  expect(container.textContent).toContain("Historique autorisé")
  expect(container.textContent).toContain("Correction")
})

it("demande la moyenne au serveur depuis l’onglet moyennes", async () => {
  await clickTab("Moyennes")
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Calculer côté serveur")!
  const form = button.closest("form")!
  form.querySelector<HTMLSelectElement>('[name="classId"]')!.value = "c"
  form.querySelector<HTMLSelectElement>('[name="periodId"]')!.value = "p"
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
  expect(mocks.results).toHaveBeenCalledWith("c", "p")
  expect(container.textContent).toContain("13.00/20")
  expect(container.textContent).toContain("matières 2/2 — saisies 4/4")
})

it("masque les onglets sensibles au professeur", async () => {
  mocks.user = { role: "professeur" }
  await act(async () => { root.render(<NotesPage />) })
  expect(tabLabels().join(" | ")).not.toContain("Configuration")
  expect(tabLabels().join(" | ")).not.toContain("Moyennes")
  expect(container.querySelector('select[name="absenceStatus"]')).not.toBeNull()
})

// --- Périmètre : plus de diffusion dans la page de saisie ------------------

it("n’héberge plus les bulletins ni la décision annuelle", () => {
  expect(container.textContent).not.toContain("Bulletins officiels")
  expect(container.textContent).not.toContain("Calculer l’année")
  expect(container.textContent).not.toContain("Valider et figer le résultat")
})
