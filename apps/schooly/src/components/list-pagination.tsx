"use client"

// apps/schooly/src/components/list-pagination.tsx
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export type ListPaginationProps = {
  /** Page courante (1-indexée). */
  page: number
  /** Nombre total de pages (>= 1). */
  totalPages: number
  /** Nombre total d'éléments toutes pages confondues. */
  total: number
  /** Libellé au singulier, ex. « élève ». */
  singularLabel: string
  /** Libellé au pluriel, ex. « élèves ». */
  pluralLabel: string
  onPageChange: (page: number) => void
}

/**
 * Barre de pagination générique : compteur « N éléments · page X sur Y »
 * et boutons Précédent / Suivant bornés. Les boutons disparaissent
 * quand tout tient sur une seule page.
 */
export function ListPagination({
  page,
  totalPages,
  total,
  singularLabel,
  pluralLabel,
  onPageChange,
}: ListPaginationProps) {
  const itemLabel = total === 1 ? singularLabel : pluralLabel
  const showButtons = totalPages > 1

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
        {total} {itemLabel} · page {page} sur {totalPages}
      </p>
      {showButtons && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </nav>
  )
}
