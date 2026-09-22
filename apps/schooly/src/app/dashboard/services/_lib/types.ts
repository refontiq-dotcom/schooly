// Types structurels des données services. Ils décrivent uniquement les
// champs réellement lus par les écrans : le reste de la ligne Supabase
// (non utilisé à ce jour) reste toléré.

export type DormRoom = {
  id: string
  room_number: string
  capacity: number
  /** Alimenté par la vue : nom du dortoir parent (jointure aplatie). */
  dormitory_name?: string | null
}

export type Dormitory = {
  id: string
  name: string
  gender_restriction: string
  capacity: number
  supervisor_name?: string | null
  dorm_rooms?: DormRoom[] | null
}

/** Référence enrollment → élève/classe telle que renvoyée par la jointure. */
export type ServiceEnrollmentRef = {
  students?: { last_name?: string | null; first_name?: string | null } | null
  classes?: { name?: string | null } | null
}

export type EnrollmentOption = ServiceEnrollmentRef & { id: string }

export type ServiceSub = {
  id: string
  status: string
  amount_cfa: number | null
  start_date: string
  /** Cantine uniquement. */
  plan_type?: string | null
  enrollments?: ServiceEnrollmentRef | null
  /** Internat uniquement : chambre affectée avec son dortoir. */
  dorm_rooms?: {
    room_number: string
    dormitories?: { name?: string | null } | null
  } | null
}

export type CanteenMenu = {
  id: string
  date: string
  meal_type: string
  description: string
}

/* ── Transport ─────────────────────────────────────────────────────────── */

export type BusStop = {
  id: string
  name: string
  pickup_time?: string | null
}

export type BusRoute = {
  id: string
  name: string
  driver_name?: string | null
  driver_phone?: string | null
  vehicle_plate?: string | null
  capacity?: number | null
  monthly_fee_cfa: number
  is_active: boolean
  bus_stops?: BusStop[] | null
}

export type TransportSub = {
  id: string
  status: string
  start_date: string
  enrollments?: ServiceEnrollmentRef | null
  bus_routes?: { id: string; name: string } | null
  bus_stops?: { id: string; name: string } | null
}

/** Résultat normalisé des server actions services (voir actions.ts). */
export type ActionResult = { ok?: boolean; error?: string }

/** Resserre le résultat d'une server action au type ActionResult. */
export function asActionResult(value: unknown): ActionResult {
  return (value ?? {}) as ActionResult
}

/** Vrai si le résultat d'action est un succès (absence d'erreur). */
export function isActionOk(result: ActionResult): boolean {
  return !result.error
}
