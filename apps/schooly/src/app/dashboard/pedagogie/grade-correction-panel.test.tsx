// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { GradeEntryRow } from "./actions"
const mocks = vi.hoisted(() => ({
  save: vi.fn<() => Promise<{ error?: string }>>(async () => ({})),
  history: vi.fn(async () => ({ data: [{ id: "h", revision: 2, old_value: 12, new_value: null, old_status: "graded", new_status: "excused", reason: "Justificatif reçu", corrected_by: "prof", corrected_at: "2026-09-17", old_comment: null, new_comment: null }] })),
  reload: vi.fn(async () => {}),
}))
vi.mock("./grade-correction-actions", () => ({ correctGradeEntry: mocks.save, getGradeCorrections: mocks.history }))
import { GradeCorrectionPanel } from "./grade-correction-panel"
const grade: GradeEntryRow = {
  id: "g", revision: 1, assessment_id: "a", period_id: "p", grade_type: "devoir", label: "DS1",
  value: 12, max_value: 20, weight: 1, absence_status: "graded", comment: null,
  created_at: "2026-09-17", created_by: "prof", users: null, enrollment_id: "e", enrollments: null, subject_id: "s", subjects: null,
}
let container: HTMLDivElement, root: Root
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  vi.clearAllMocks(); mocks.save.mockResolvedValue({})
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<GradeCorrectionPanel grade={grade} locked={false} onSaved={mocks.reload} />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
async function submit() {
  container.querySelector<HTMLInputElement>('[name="reason"]')!.value = "Erreur de report"
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
}
it("envoie la version affichée et recharge après confirmation", async () => {
  expect(container.querySelector<HTMLInputElement>('[name="reason"]')!.required).toBe(true)
  await submit()
  const [form] = mocks.save.mock.calls[0] as unknown as [FormData]
  expect(form.get("revision")).toBe("1"); expect(form.get("gradeId")).toBe("g")
  expect(form.get("reason")).toBe("Erreur de report"); expect(mocks.reload).toHaveBeenCalledOnce()
})
it("affiche le conflit sans annoncer de succès ni recharger", async () => {
  mocks.save.mockResolvedValue({ error: "Cette note a été modifiée. Rechargez avant de corriger." })
  await submit()
  expect(container.textContent).toContain("Cette note a été modifiée")
  expect(mocks.reload).not.toHaveBeenCalled()
  expect(container.textContent).not.toContain("Correction enregistrée.")
})
it("désactive la valeur pour ABS", async () => {
  const select = container.querySelector("select")!
  await act(async () => { select.value = "excused"; select.dispatchEvent(new Event("change", { bubbles: true })) })
  await submit()
  const [form] = mocks.save.mock.calls[0] as unknown as [FormData]
  expect(form.get("value")).toBeNull(); expect(form.get("absenceStatus")).toBe("excused")
})
it("masque la correction fermée mais conserve l'accès au journal", async () => {
  await act(async () => root.render(<GradeCorrectionPanel grade={grade} locked onSaved={mocks.reload} />))
  expect(container.querySelector("form")).toBeNull()
  await act(async () => container.querySelector("button")!.click())
  expect(container.textContent).toContain("12 → ABS")
  expect(container.textContent).toContain("Justificatif reçu")
})
