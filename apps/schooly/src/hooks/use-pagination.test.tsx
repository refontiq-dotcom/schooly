// @vitest-environment jsdom
// apps/schooly/src/hooks/use-pagination.test.ts
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clampPage, DEFAULT_PAGE_SIZE, paginate, usePagination } from "./use-pagination"

// ===========================================================================
// paginate — découpe immuable d'une liste
// ===========================================================================

describe("paginate — découpe immuable d'une liste", () => {
  const lots = Array.from({ length: 45 }, (_, i) => `item-${i + 1}`)

  it("retourne les 20 premiers éléments pour la page 1", () => {
    const { pageItems, totalPages } = paginate(lots, 1, 20)
    expect(pageItems).toHaveLength(20)
    expect(pageItems[0]).toBe("item-1")
    expect(pageItems[19]).toBe("item-20")
    expect(totalPages).toBe(3)
  })

  it("retourne la dernière page partielle (5 éléments sur la page 3)", () => {
    const { pageItems, totalPages } = paginate(lots, 3, 20)
    expect(pageItems).toHaveLength(5)
    expect(pageItems[0]).toBe("item-41")
    expect(totalPages).toBe(3)
  })

  it("retourne une découpe vide pour une page au-delà de la dernière", () => {
    const { pageItems } = paginate(lots, 99, 20)
    expect(pageItems).toEqual([])
  })

  it("retourne un total de pages de 1 pour une liste vide", () => {
    const { pageItems, totalPages } = paginate([], 1, 20)
    expect(pageItems).toEqual([])
    expect(totalPages).toBe(1)
  })

  it("traite une taille de page invalide (0) comme la taille par défaut", () => {
    const { pageItems, totalPages } = paginate(lots, 1, 0)
    expect(pageItems).toHaveLength(DEFAULT_PAGE_SIZE)
    expect(totalPages).toBe(3)
  })

  it("ne mute jamais la liste source et rend un nouveau tableau", () => {
    const source = ["a", "b", "c", "d"]
    const { pageItems } = paginate(source, 2, 2)
    expect(source).toEqual(["a", "b", "c", "d"])
    expect(pageItems).not.toBe(source)
    expect(pageItems).toEqual(["c", "d"])
  })
})

// ===========================================================================
// clampPage — bornes de navigation
// ===========================================================================

describe("clampPage — bornes de navigation", () => {
  it("borne en bas à la page 1", () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-3, 5)).toBe(1)
  })

  it("borne en haut à la dernière page", () => {
    expect(clampPage(9, 5)).toBe(5)
  })

  it("garde une page déjà dans les bornes", () => {
    expect(clampPage(2, 5)).toBe(2)
  })

  it("garantit une borne haute d'au moins 1 même sur liste vide", () => {
    expect(clampPage(4, 0)).toBe(1)
    expect(clampPage(1, 0)).toBe(1)
  })


// ===========================================================================
// usePagination — hook de navigation (testé via un harnais React minimal)
// ===========================================================================

type PaginationApi<T> = {
  pageItems: T[]
  total: number
  page: number
  totalPages: number
  canGoPrev: boolean
  canGoNext: boolean
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  reset: () => void
}

let latest: PaginationApi<string> | null = null
let container: HTMLDivElement
let root: Root

function Probe({ items, pageSize }: { items: readonly string[]; pageSize?: number }) {
  latest = usePagination(items, pageSize)
  return null
}

async function render(items: readonly string[], pageSize?: number) {
  await act(async () => {
    root.render(<Probe items={items} pageSize={pageSize} />)
  })
}

const fortyFive = Array.from({ length: 45 }, (_, i) => `item-${i + 1}`)

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })
  latest = null
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("usePagination — navigation paginée", () => {
  it("démarre sur la page 1 avec la taille par défaut de 20", async () => {
    await render(fortyFive)
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems).toHaveLength(20)
    expect(latest!.total).toBe(45)
    expect(latest!.totalPages).toBe(3)
  })

  it("calcule canGoPrev / canGoNext selon la position", async () => {
    await render(fortyFive)
    expect(latest!.canGoPrev).toBe(false)
    expect(latest!.canGoNext).toBe(true)
    await act(async () => latest!.nextPage())
    expect(latest!.canGoPrev).toBe(true)
    expect(latest!.canGoNext).toBe(true)
    await act(async () => latest!.goToPage(3))
    expect(latest!.canGoNext).toBe(false)
  })

  it("navigue en avant puis en arrière", async () => {
    await render(fortyFive)
    await act(async () => latest!.nextPage())
    expect(latest!.page).toBe(2)
    expect(latest!.pageItems[0]).toBe("item-21")
    await act(async () => latest!.prevPage())
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems[0]).toBe("item-1")
  })

  it("se borne aux extrémités sans dépasser la dernière page", async () => {
    await render(fortyFive)
    await act(async () => latest!.goToPage(3))
    await act(async () => latest!.nextPage())
    expect(latest!.page).toBe(3)
    await act(async () => latest!.prevPage())
    await act(async () => latest!.prevPage())
    await act(async () => latest!.prevPage())
    expect(latest!.page).toBe(1)
  })

  it("clampe une demande de page hors bornes", async () => {
    await render(fortyFive)
    await act(async () => latest!.goToPage(42))
    expect(latest!.page).toBe(3)
    await act(async () => latest!.goToPage(-2))
    expect(latest!.page).toBe(1)
  })

  it("reset revient à la page 1", async () => {
    await render(fortyFive)
    await act(async () => latest!.goToPage(2))
    await act(async () => latest!.reset())
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems[0]).toBe("item-1")
  })

  it("ramène automatiquement à une page valide quand la liste rétrécit", async () => {
    await render(fortyFive)
    await act(async () => latest!.goToPage(3))
    const smaller = fortyFive.slice(0, 10)
    await render(smaller)
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems).toHaveLength(10)
    expect(latest!.totalPages).toBe(1)
  })

  it("retourne à la page 1 quand la taille de page change", async () => {
    await render(fortyFive, 20)
    await act(async () => latest!.goToPage(2))
    await render(fortyFive, 10)
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems).toHaveLength(10)
    expect(latest!.totalPages).toBe(5)
  })

  it("utilise la taille par défaut quand pageSize est invalide", async () => {
    await render(fortyFive, 0)
    expect(latest!.pageItems).toHaveLength(DEFAULT_PAGE_SIZE)
  })

  it("gère une liste vide sans erreur", async () => {
    await render([])
    expect(latest!.page).toBe(1)
    expect(latest!.pageItems).toEqual([])
    expect(latest!.totalPages).toBe(1)
    expect(latest!.canGoNext).toBe(false)
  })
})

  it("ramène une valeur non numérique à la page 1", () => {
    expect(clampPage(Number.NaN, 5)).toBe(1)
  })
})
