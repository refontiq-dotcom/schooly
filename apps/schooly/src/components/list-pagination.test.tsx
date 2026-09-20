// @vitest-environment jsdom
// apps/schooly/src/components/list-pagination.test.tsx
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ListPagination } from "./list-pagination"

// Le lockfile installe deux copies de react (racine 19.3.0 / app 19.2.8) :
// lucide-react résout la copie locale et casse le rendu. Les icônes sont
// stubbées — ce test porte sur la pagination, pas sur le SVG.
vi.mock("lucide-react", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
}))

let container: HTMLDivElement
let root: Root
let onPageChange: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  onPageChange = vi.fn()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(props: Partial<Parameters<typeof ListPagination>[0]> = {}) {
  const merged = {
      page: 1,
    totalPages: 3,
    total: 45,
    singularLabel: "élève",
    pluralLabel: "élèves",
    onPageChange: onPageChange as (page: number) => void,
    ...props,
  }
  await act(async () => {
    root.render(<ListPagination {...merged} />)
  })
}

function prevButton() {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Page précédente"]')!
}
function nextButton() {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Page suivante"]')!
}

it("affiche le total et la position courante", async () => {
  await render()
  expect(container.textContent).toContain("45 élèves")
  expect(container.textContent).toContain("page 1 sur 3")
})

it("utilise le singulier pour un seul élément", async () => {
  await render({ total: 1, totalPages: 1, page: 1 })
  expect(container.textContent).toContain("1 élève ·")
  expect(container.textContent).not.toContain("élèves")
})

it("désactive Précédent sur la première page et Suivant sur la dernière", async () => {
  await render()
  expect(prevButton().disabled).toBe(true)
  expect(nextButton().disabled).toBe(false)

  await render({ page: 3, totalPages: 3 })
  expect(prevButton().disabled).toBe(false)
  expect(nextButton().disabled).toBe(true)
})

it("émet onPageChange avec la page précédente puis suivante", async () => {
  await render({ page: 2, totalPages: 3 })
  await act(async () => prevButton().dispatchEvent(new MouseEvent("click", { bubbles: true })))
  expect(onPageChange).toHaveBeenCalledWith(1)
  await act(async () => nextButton().dispatchEvent(new MouseEvent("click", { bubbles: true })))
  expect(onPageChange).toHaveBeenCalledWith(3)
})

it("masque les boutons de navigation quand une seule page existe", async () => {
  await render({ total: 12, totalPages: 1, page: 1 })
  expect(container.querySelector("button")).toBeNull()
  expect(container.textContent).toContain("12 élèves")
  expect(container.textContent).toContain("page 1 sur 1")
})

it("expose une navigation accessible", async () => {
  await render()
  const nav = container.querySelector("nav")
  expect(nav).not.toBeNull()
  expect(nav!.getAttribute("aria-label")).toBe("Pagination")
})
