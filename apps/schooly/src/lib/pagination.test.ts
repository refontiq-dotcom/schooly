import { describe, expect, it } from "vitest"
import {
  buildPageResult,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageRange,
  resolvePageRequest,
} from "./pagination"

describe("resolvePageRequest", () => {
  it("sans opts, demande la liste complète", () => {
    expect(resolvePageRequest()).toEqual({
      wantsPagination: false,
      page: 1,
      pageSize: 1,
    })
    expect(resolvePageRequest(undefined).wantsPagination).toBe(false)
  })

  it("avec opts, pagine et applique la taille par défaut", () => {
    expect(resolvePageRequest({})).toEqual({
      wantsPagination: true,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    expect(resolvePageRequest({ page: 3, pageSize: 20 })).toEqual({
      wantsPagination: true,
      page: 3,
      pageSize: 20,
    })
  })

  it("borne la page et la taille à un domaine sûr", () => {
    expect(resolvePageRequest({ page: 0 }).page).toBe(1)
    expect(resolvePageRequest({ page: -5 }).page).toBe(1)
    expect(resolvePageRequest({ pageSize: 0 }).pageSize).toBe(1)
    expect(resolvePageRequest({ pageSize: -10 }).pageSize).toBe(1)
    expect(resolvePageRequest({ pageSize: 10_000 }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it("neutralise les entrées non numériques (NaN, fractions)", () => {
    expect(resolvePageRequest({ page: Number.NaN }).page).toBe(1)
    expect(resolvePageRequest({ pageSize: Number.NaN }).pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(resolvePageRequest({ page: 2.9 }).page).toBe(2)
    expect(resolvePageRequest({ pageSize: 12.7 }).pageSize).toBe(12)
  })
})

describe("pageRange", () => {
  it("convertit la page en plage offset/limit inclusive", () => {
    expect(pageRange(resolvePageRequest({ page: 1, pageSize: 50 }))).toEqual({
      from: 0,
      to: 49,
    })
    expect(pageRange(resolvePageRequest({ page: 3, pageSize: 20 }))).toEqual({
      from: 40,
      to: 59,
    })
  })
})

describe("buildPageResult", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `row-${index}` }))

  it("liste complète : total = nombre de lignes rendues, une seule page", () => {
    const result = buildPageResult(rows(3), 3, resolvePageRequest())

    expect(result.data).toHaveLength(3)
    expect(result).toMatchObject({ page: 1, pageSize: 3, total: 3, totalPages: 1 })
  })

  it("liste vide : pageSize non nul pour ne jamais diviser par zéro", () => {
    expect(buildPageResult([], 0, resolvePageRequest())).toMatchObject({
      pageSize: 1,
      total: 0,
      totalPages: 1,
    })
    expect(
      buildPageResult([], 0, resolvePageRequest({ pageSize: 20 }))
    ).toMatchObject({ pageSize: 20, total: 0, totalPages: 1 })
  })

  it("page paginée : calcule totalPages et rend la page demandée", () => {
    const result = buildPageResult(rows(20), 95, resolvePageRequest({ page: 2, pageSize: 20 }))

    expect(result).toMatchObject({ page: 2, pageSize: 20, total: 95, totalPages: 5 })
  })

  it("page au-delà de la fin : ramène la dernière page (pas de page vide)", () => {
    const result = buildPageResult(rows(20), 95, resolvePageRequest({ page: 99, pageSize: 20 }))

    expect(result.page).toBe(5)
    expect(result.totalPages).toBe(5)
  })

  it("count absent : se replie sur le nombre de lignes rendues", () => {
    const result = buildPageResult(rows(20), null, resolvePageRequest({ pageSize: 20 }))

    expect(result).toMatchObject({ total: 20, totalPages: 1, page: 1 })
  })

  it("count incohérent (0 sans lignes) ne produit pas de page négative", () => {
    expect(
      buildPageResult([], null, resolvePageRequest({ pageSize: 20 }))
    ).toMatchObject({ total: 0, totalPages: 1 })
  })
})
