// apps/schooly/src/app/dashboard/direction/financial-kpis.ts
//
// S1 : les KPI financiers du tableau de bord direction (cumul de l'exercice,
// comparaison M / M-1, ventilation par mode de paiement, série journalière sans
// trou) sont désormais agrégés en base par la RPC `get_direction_financial_kpis`
// (migration 20260924000000). Ce module isole :
// - le contrat de la charge utile JSONB et sa validation de frontière (les
//   données viennent de Postgres : elles sont traitées comme non fiables) ;
// - l'appel RPC et sa dégradation gracieuse — en cas d'erreur la fonction
//   renvoie `null`, le loader retombe sur l'agrégation JS historique plutôt
//   que d'afficher des indicateurs faux ou une page en erreur.

import { unstable_cache } from "next/cache"
import {
  DIRECTION_DASHBOARD_CACHE_TAG,
  READ_CACHE_TTL_SECONDS,
} from "@/lib/cache-tags"
import { logServerEvent } from "@/lib/server-logger"

/**
 * Signature RPC PostgREST minimale : `rpc(name, args)` awaitable.
 *
 * supabase-js renvoie un `PostgrestFilterBuilder` (thenable, pas une vraie
 * Promise) : on exige la forme awaitable plutôt que `Promise` stricte pour
 * rester assignable au client réel sans cast aux sites d'appel.
 */
export type RpcCall = (
  name: string,
  args: Record<string, unknown>
) => PromiseLike<{
  data: unknown
  error: { message: string } | null
}>

export const DIRECTION_FINANCIAL_KPIS_RPC = "get_direction_financial_kpis"
export const DIRECTION_BALANCE_KPIS_RPC = "get_direction_balance_kpis"

/** Préfixes d'événements : distingue les familles d'agrégats dans les journaux. */
const FINANCIAL_KPIS_EVENT = "direction.financial_kpis"
const BALANCE_KPIS_EVENT = "direction.balance_kpis"

/** KPI financiers normalisés (camelCase) consommés par le modèle de vue. */
export type DirectionFinancialKpis = {
  collectedThisYear: number
  collectedThisMonth: number
  collectedPreviousMonth: number
  byMethod: Array<{ method: string; total: number }>
  daily: Array<{ date: string; total: number }>
}

export type DirectionFinancialKpisParams = {
  schoolId: string
  academicYearId: string
  /** Date de référence : borne « aujourd'hui » et découpe M / M-1. */
  now: Date
  /** Fenêtre de la série journalière (jours), aujourd'hui inclus. */
  dailyWindow: number
}

/**
 * Soldes agrégés en base : le loader n'a plus besoin des lignes de paiement
 * pour déterminer qui doit quoi, ni le total encaissé dans la session ouverte.
 */
export type DirectionBalanceKpis = {
  /** Total encaissé par inscription, pour les seules inscriptions créditées. */
  enrollmentPaid: Array<{ enrollmentId: string; paid: number }>
  /** Total encaissé dans la session demandée (0 si aucune session). */
  sessionPaid: number
}

export type DirectionBalanceKpisParams = {
  schoolId: string
  academicYearId: string
  /** Session de caisse ouverte ; `null` si la caisse est fermée. */
  cashSessionId: string | null
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Longueur maximale tolérée pour un identifiant renvoyé par la base (uuid). */
const MAX_ID_LENGTH = 64

/** Montant JSON exploitable : nombre fini, jamais NaN/Infinity/string. */
function toAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseByMethod(value: unknown): Array<{ method: string; total: number }> | null {
  if (!Array.isArray(value)) return null
  const rows: Array<{ method: string; total: number }> = []
  for (const entry of value) {
    if (entry == null || typeof entry !== "object") return null
    const { method, total } = entry as { method?: unknown; total?: unknown }
    const amount = toAmount(total)
    if (typeof method !== "string" || amount === null) return null
    rows.push({ method, total: amount })
  }
  return rows
}

function parseDaily(value: unknown): Array<{ date: string; total: number }> | null {
  if (!Array.isArray(value)) return null
  const rows: Array<{ date: string; total: number }> = []
  for (const entry of value) {
    if (entry == null || typeof entry !== "object") return null
    const { date, total } = entry as { date?: unknown; total?: unknown }
    const amount = toAmount(total)
    if (typeof date !== "string" || !ISO_DAY_RE.test(date) || amount === null) {
      return null
    }
    rows.push({ date, total: amount })
  }
  return rows
}

/**
 * Valide la charge utile JSONB de la RPC. Toute forme inattendue → `null` :
 * le loader préfère son calcul JS à des KPI partiellement corrompus.
 */
export function parseFinancialKpis(raw: unknown): DirectionFinancialKpis | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>

  const collectedThisYear = toAmount(value.collected_this_year)
  const collectedThisMonth = toAmount(value.collected_this_month)
  const collectedPreviousMonth = toAmount(value.collected_previous_month)
  if (
    collectedThisYear === null ||
    collectedThisMonth === null ||
    collectedPreviousMonth === null
  ) {
    return null
  }

  const byMethod = parseByMethod(value.by_method)
  const daily = parseDaily(value.daily_series)
  if (byMethod === null || daily === null) return null

  return {
    collectedThisYear,
    collectedThisMonth,
    collectedPreviousMonth,
    byMethod,
    daily,
  }
}

/**
 * Valide la charge utile JSONB des soldes. Comme pour les KPI, toute forme
 * inattendue → `null` : un solde partiel afficherait un encours faux, ce qui
 * est plus grave qu'un repli sur le calcul applicatif.
 */
export function parseBalanceKpis(raw: unknown): DirectionBalanceKpis | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>

  const sessionPaid = toAmount(value.session_paid)
  if (sessionPaid === null) return null

  if (!Array.isArray(value.enrollment_paid)) return null
  const enrollmentPaid: Array<{ enrollmentId: string; paid: number }> = []
  for (const entry of value.enrollment_paid) {
    if (entry == null || typeof entry !== "object") return null
    const { enrollment_id, paid } = entry as {
      enrollment_id?: unknown
      paid?: unknown
    }
    const amount = toAmount(paid)
    if (typeof enrollment_id !== "string") return null
    if (enrollment_id.length === 0 || enrollment_id.length > MAX_ID_LENGTH) {
      return null
    }
    if (amount === null) return null
    enrollmentPaid.push({ enrollmentId: enrollment_id, paid: amount })
  }

  return { enrollmentPaid, sessionPaid }
}

/**
 * Interroge la RPC et renvoie les KPI validés, ou `null` si la base refuse /
 * échoue (le journal porte alors le motif, sans donnée personnelle).
 */
/**
 * Appel RPC commun : la réponse PostgREST est traitée comme non fiable — erreur
 * base, exception réseau, charge utile refusée par le validateur — et chaque cas
 * est journalisé avant de renvoyer `null`, pour que l'appelant retombe sur son
 * calcul JS plutôt que d'afficher un indicateur faux. Le préfixe d'événement
 * distingue les familles d'agrégats sans dupliquer la gestion d'erreur.
 */
async function callRpc<T>(
  rpc: RpcCall,
  event: string,
  name: string,
  args: Record<string, unknown>,
  context: Record<string, string>,
  parse: (raw: unknown) => T | null
): Promise<T | null> {
  try {
    const { data, error } = await rpc(name, args)
    if (error) {
      logServerEvent("warn", `${event}_rpc_failed`, {
        ...context,
        message: error.message,
      })
      return null
    }

    const parsed = parse(data)
    if (parsed === null) {
      logServerEvent("warn", `${event}_rpc_invalid`, context)
    }
    return parsed
  } catch (error: unknown) {
    logServerEvent("warn", `${event}_rpc_failed`, {
      ...context,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    })
    return null
  }
}

export async function fetchDirectionFinancialKpis(
  rpc: RpcCall,
  params: DirectionFinancialKpisParams
): Promise<DirectionFinancialKpis | null> {
  return callRpc(
    rpc,
    FINANCIAL_KPIS_EVENT,
    DIRECTION_FINANCIAL_KPIS_RPC,
    {
      p_school_id: params.schoolId,
      p_academic_year_id: params.academicYearId,
      p_now: params.now.toISOString(),
      p_daily_window: params.dailyWindow,
    },
    { schoolId: params.schoolId, academicYearId: params.academicYearId },
    parseFinancialKpis
  )
}

/**
 * Interroge la RPC des soldes : total encaissé par inscription de l'exercice et
 * total de la session de caisse demandée, avec le même repli que les KPI.
 */
export async function fetchDirectionBalanceKpis(
  rpc: RpcCall,
  params: DirectionBalanceKpisParams
): Promise<DirectionBalanceKpis | null> {
  return callRpc(
    rpc,
    BALANCE_KPIS_EVENT,
    DIRECTION_BALANCE_KPIS_RPC,
    {
      p_school_id: params.schoolId,
      p_academic_year_id: params.academicYearId,
      p_cash_session_id: params.cashSessionId,
    },
    { schoolId: params.schoolId, academicYearId: params.academicYearId },
    parseBalanceKpis
  )
}

/**
 * Variante mise en cache (Data Cache Next) de `fetchDirectionFinancialKpis`.
 *
 * Même tag et TTL que les lectures de lignes du dashboard : une écriture
 * (encaissement, annulation) purge les deux entrées d'un seul `updateTag`.
 * La clé inclut le jour de référence (les bornes mensuelles et la série
 * journalière en dépendent) et la fenêtre demandée.
 *
 * `rpc === null` (client sans RPC) → `null` : l'appelant conserve son
 * agrégation JS, sans requête inutile.
 */
export async function loadDirectionFinancialKpis(
  rpc: RpcCall | null,
  params: DirectionFinancialKpisParams
): Promise<DirectionFinancialKpis | null> {
  if (rpc === null) return null

  const cached = unstable_cache(
    () => fetchDirectionFinancialKpis(rpc, params),
    [
      "direction-dashboard-kpis",
      params.schoolId,
      params.academicYearId,
      params.now.toISOString().slice(0, 10),
      String(params.dailyWindow),
    ],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [DIRECTION_DASHBOARD_CACHE_TAG] }
  )
  return cached()
}

/**
 * Variante mise en cache des soldes. Même tag et même TTL que les KPI : une
 * écriture money purge les trois entrées (lignes du repli, KPI, soldes). La clé
 * suit l'école, l'exercice et la session demandée — changer de session de caisse
 * ne doit jamais afficher le total de la précédente.
 */
export async function loadDirectionBalanceKpis(
  rpc: RpcCall | null,
  params: DirectionBalanceKpisParams
): Promise<DirectionBalanceKpis | null> {
  if (rpc === null) return null

  const cached = unstable_cache(
    () => fetchDirectionBalanceKpis(rpc, params),
    [
      "direction-dashboard-balances",
      params.schoolId,
      params.academicYearId,
      params.cashSessionId ?? "no-session",
    ],
    { revalidate: READ_CACHE_TTL_SECONDS, tags: [DIRECTION_DASHBOARD_CACHE_TAG] }
  )
  return cached()
}
