/**
 * Contrat de pagination des listes lues en base.
 *
 * Un seul endroit définit ce que « paginer » veut dire : résolution et bornage
 * de la requête, plage `.range()`, et métadonnées de réponse. Les getters du
 * dashboard l'appliquent à l'identique (historique : `getPayments`,
 * `getEnrollments`, `getPreEnrollments`), ce qui évite quatre copies du même
 * arithmétique — et donc quatre occasions de se tromper.
 *
 * Compatibilité : sans `opts`, le getter renvoie la liste complète (certains
 * appelants — construction d'une carte, déroulés — ont besoin de l'ensemble).
 * Avec `opts`, la liste est bornée en base et la réponse porte `total` /
 * `totalPages`.
 */

/** Plafond dur : une page ne ramène jamais plus de lignes que cela. */
export const MAX_PAGE_SIZE = 100

/** Taille de page retenue quand l'appelant demande une pagination sans taille. */
export const DEFAULT_PAGE_SIZE = 50

export type PageRequestOptions = {
  page?: number
  pageSize?: number
}

export type PageRequest = {
  /** `false` quand aucun `opts` n'est fourni : liste complète attendue. */
  wantsPagination: boolean
  page: number
  pageSize: number
}

/**
 * Normalise une demande de page. `NaN`, les fractions, les valeurs négatives et
 * les tailles absurdes sont ramenées à un domaine sûr — une entrée utilisateur
 * ne doit jamais produire une requête illimitée ni un `range` négatif.
 */
export function resolvePageRequest(opts?: PageRequestOptions): PageRequest {
  if (opts === undefined) {
    return { wantsPagination: false, page: 1, pageSize: 1 }
  }
  const requestedSize = Math.floor(Number(opts.pageSize ?? DEFAULT_PAGE_SIZE))
  const pageSize = Number.isFinite(requestedSize)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize))
    : DEFAULT_PAGE_SIZE
  const requestedPage = Math.floor(Number(opts.page ?? 1))
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
  return { wantsPagination: true, page, pageSize }
}

/** Plage `.range()` inclusive correspondant à la demande. */
export function pageRange(request: PageRequest): { from: number; to: number } {
  const from = (request.page - 1) * request.pageSize
  return { from, to: from + request.pageSize - 1 }
}

export type PageResult<T> = {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Réponse uniforme : refus de rôle, erreur base, liste complète et page
 * exposent tous les mêmes métadonnées, pour que l'appelant déstructure sans
 * garde. `page` est ramené dans le domaine réel (une page au-delà de la fin
 * renvoie la dernière page, pas une page vide qui « saute » le contenu).
 */
export function buildPageResult<T>(
  rows: T[],
  count: number | null | undefined,
  request: PageRequest
): PageResult<T> {
  if (!request.wantsPagination) {
    return {
      data: rows,
      page: 1,
      pageSize: rows.length || 1,
      total: rows.length,
      totalPages: 1,
    }
  }

  const total = Math.max(0, count ?? rows.length)
  const totalPages = Math.max(1, Math.ceil(total / request.pageSize))
  return {
    data: rows,
    page: Math.min(request.page, totalPages),
    pageSize: request.pageSize,
    total,
    totalPages,
  }
}
