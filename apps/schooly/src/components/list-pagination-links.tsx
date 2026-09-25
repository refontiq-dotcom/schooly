"use client"

// apps/schooly/src/components/list-pagination-links.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ListPagination } from "./list-pagination"

export type ListPaginationLinksProps = {
  /** Page courante (1-indexée, déjà bornée par le serveur). */
  page: number
  /** Nombre total de pages (>= 1). */
  totalPages: number
  /** Nombre total d'éléments toutes pages confondues. */
  total: number
  /** Libellé au singulier, ex. « encaissement ». */
  singularLabel: string
  /** Libellé au pluriel, ex. « encaissements ». */
  pluralLabel: string
  /** Nom du search param pilotant la page (défaut : `page`). */
  paramKey?: string
}

/**
 * Variante serveur de `ListPagination` : la navigation pilote l'URL
 * (`?page=N`) via le router Next, préservant les search params existants.
 * À utiliser dans les pages Server Component dont la donnée est paginée
 * en base (`.range()`), pas en mémoire.
 */
export function ListPaginationLinks({
  page,
  totalPages,
  total,
  singularLabel,
  pluralLabel,
  paramKey = "page",
}: ListPaginationLinksProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete(paramKey)
    else params.set(paramKey, String(next))
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <ListPagination
      page={page}
      totalPages={totalPages}
      total={total}
      singularLabel={singularLabel}
      pluralLabel={pluralLabel}
      onPageChange={goToPage}
    />
  )
}
