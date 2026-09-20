"use client"

// apps/schooly/src/hooks/use-pagination.ts
import { useCallback, useMemo, useState } from "react"

/** Taille de page par défaut des listes du dashboard. */
export const DEFAULT_PAGE_SIZE = 20

const MIN_PAGE = 1

/** Découpe immuable : éléments de `page` et nombre total de pages (>= 1). */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): { pageItems: T[]; totalPages: number } {
  const size = pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE
  const totalPages = Math.max(MIN_PAGE, Math.ceil(items.length / size))
  const start = (page - MIN_PAGE) * size
  return {
    pageItems: items.slice(start, start + size),
    totalPages,
  }
}

/** Ramène toute demande de page dans l'intervalle [1, max(totalPages, 1)]. */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return MIN_PAGE
  return Math.min(Math.max(Math.floor(page), MIN_PAGE), Math.max(totalPages, MIN_PAGE))
}

export type PaginationState<T> = {
  /** Éléments de la page courante uniquement. */
  pageItems: T[]
  /** Nombre total d'éléments toutes pages confondues. */
  total: number
  /** Page courante (1-indexée, toujours valide). */
  page: number
  /** Nombre total de pages (>= 1). */
  totalPages: number
  canGoPrev: boolean
  canGoNext: boolean
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  /** Revient à la première page (après un changement de filtre, par exemple). */
  reset: () => void
}

/**
 * Pagination côté client d'une liste déjà chargée en mémoire.
 *
 * La page est automatiquement ramenée dans les bornes quand la liste
 * rétrécit (suppression d'un élève) ou quand la taille de page change
 * (retour à la page 1) — ajustement d'état pendant le rendu, sans effet.
 */
export function usePagination<T>(
  items: readonly T[],
  requestedPageSize: number = DEFAULT_PAGE_SIZE
): PaginationState<T> {
  const size = requestedPageSize > 0 ? Math.floor(requestedPageSize) : DEFAULT_PAGE_SIZE

  const [page, setPage] = useState(MIN_PAGE)
  const [activePageSize, setActivePageSize] = useState(size)

  // La taille de page change → on repart de la première page.
  if (activePageSize !== size) {
    setActivePageSize(size)
    setPage(MIN_PAGE)
  }

  const { pageItems, totalPages } = useMemo(
    () => paginate(items, page, size),
    [items, page, size]
  )

  // La liste rétrécit → la page courante peut dépasser la dernière : on clampe.
  const [boundedTotalPages, setBoundedTotalPages] = useState(totalPages)
  if (boundedTotalPages !== totalPages) {
    setBoundedTotalPages(totalPages)
    setPage((current) => clampPage(current, totalPages))
  }

  const goToPage = useCallback(
    (next: number) => setPage(clampPage(next, totalPages)),
    [totalPages]
  )
  const nextPage = useCallback(
    () => setPage((current) => clampPage(current + 1, totalPages)),
    [totalPages]
  )
  const prevPage = useCallback(
    () => setPage((current) => clampPage(current - 1, totalPages)),
    [totalPages]
  )
  const reset = useCallback(() => setPage(MIN_PAGE), [])

  return {
    pageItems,
    total: items.length,
    page,
    totalPages,
    canGoPrev: page > MIN_PAGE,
    canGoNext: page < totalPages,
    goToPage,
    nextPage,
    prevPage,
    reset,
  }
}
