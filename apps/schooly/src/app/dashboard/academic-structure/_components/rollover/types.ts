import { CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react"

/** Types partagés du panneau de bascule d'année. */

export type AcademicYear = {
  id: string
  label: string
  start_date: string
  end_date: string
  status: string
}

export type PreviewRow = {
  id: string
  studentName: string
  className: string
  gradeLevelId?: string
  gradeLevelName: string
  gradeLevelOrder: number
  decision: string
  /** Destination calculée par le même moteur que l'exécution. */
  targetStatus: "skipped" | "graduated" | "enrolled"
  targetClassId: string | null
  targetClassName: string | null
}

export type RolloverPreview = {
  total: number
  admitted: number
  repeated: number
  excluded: number
  pending: number
  /** Élèves qui seront réinscrits sans classe (appariement ambigu). */
  withoutClass: number
  graduated: number
  enrollments: PreviewRow[]
}

export type RolloverResult = {
  promoted: number
  repeated: number
  excluded: number
  pending: number
  withoutClass: number
  total: number
}

/** Ligne d'historique (`year_rollover_logs` + embeds). */
export type RolloverLog = {
  id: string
  status: string
  initiated_at: string
  students_promoted: number
  students_repeated: number
  students_excluded: number
  students_without_class: number | null
  old_year: { label: string } | null
  new_year: { label: string } | null
  initiator: { full_name: string } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function labelOf(value: unknown): { label: string } | null {
  return isRecord(value) && typeof value.label === "string"
    ? { label: value.label }
    : null
}

function fullNameOf(value: unknown): { full_name: string } | null {
  return isRecord(value) && typeof value.full_name === "string"
    ? { full_name: value.full_name }
    : null
}

function count(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** Normalise les logs bruts — les lignes invalides sont écartées. */
export function normalizeRolloverLogs(raw: unknown): RolloverLog[] {
  if (!Array.isArray(raw)) return []
  const result: RolloverLog[] = []
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== "string") continue
    result.push({
      id: row.id,
      status: typeof row.status === "string" ? row.status : "failed",
      initiated_at: typeof row.initiated_at === "string" ? row.initiated_at : "",
      students_promoted: count(row.students_promoted),
      students_repeated: count(row.students_repeated),
      students_excluded: count(row.students_excluded),
      students_without_class:
        typeof row.students_without_class === "number" ? row.students_without_class : null,
      old_year: labelOf(row.old_year),
      new_year: labelOf(row.new_year),
      initiator: fullNameOf(row.initiator),
    })
  }
  return result
}

export const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Session expirée — reconnectez-vous.",
  UNAUTHORIZED: "La bascule d'année est réservée à la direction.",
}

/** Traduit une exception de garde en message affichable (jamais d'écran vide). */
export function messageFrom(err: unknown): string {
  const raw = err instanceof Error ? err.message : ""
  return ERROR_MESSAGES[raw] ?? (raw || "Une erreur est survenue.")
}

export const YEAR_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  en_cours: { label: "En cours", variant: "default" },
  planifiee: { label: "Planifiée", variant: "secondary" },
  cloturee: { label: "Clôturée", variant: "outline" },
}

export const DECISION_LABELS: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  admitted: { label: "Admis", color: "text-green-800 bg-green-50", icon: CheckCircle2 },
  repeated: { label: "Redouble", color: "text-orange-900 bg-orange-50", icon: RotateCcw },
  excluded: { label: "Exclu", color: "text-red-700 bg-red-50", icon: XCircle },
  pending: { label: "En attente", color: "text-gray-700 bg-gray-50", icon: Clock },
}
