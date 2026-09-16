"use server"

import { createClient } from "@/utils/supabase/server"
import { requireSchoolRole } from "@/utils/supabase/require-role"
import { SERVICE_ADMIN_ROLES } from "@/utils/supabase/roles"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSchoolId() {
  const supabase = await createClient()
  // Audit P1-2 + P2-2 : la garde passe par le socle partagé (requireSchoolRole)
  // et la liste des rôles vient de la source unique (utils/supabase/roles.ts).
  const guard = await requireSchoolRole(supabase, { allowedRoles: [...SERVICE_ADMIN_ROLES] })
  if (!guard.ok) throw new Error(guard.reason)
  return { supabase, schoolId: guard.context.schoolId }
}

/**
 * Vérifie si un module complémentaire est activé pour l'école.
 * Conforme au système school_features (Phase 0 / §12.7 CdC).
 * Retourne { error } si le module est désactivé ou la vérification échoue.
 */
async function requireFeature(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  feature: "transport" | "canteen" | "boarding"
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("school_features")
    .select("enabled")
    .eq("school_id", schoolId)
    .eq("feature", feature)
    .maybeSingle()

  if (error) return { error: `Erreur vérification feature ${feature}: ${error.message}` }
  // Si la ligne n'existe pas, le module est considéré désactivé
  if (!data || !data.enabled) {
    return { error: `Module "${feature}" non activé pour cet établissement.` }
  }
  return {}
}

// ─── TRANSPORT ────────────────────────────────────────────────────────────────

export async function getBusRoutes() {
  const { supabase, schoolId } = await getSchoolId()
  const featureCheck = await requireFeature(supabase, schoolId, "transport")
  if (featureCheck.error) return { error: featureCheck.error }
  const { data, error } = await supabase
    .from("bus_routes")
    .select("*, bus_stops(id, name, pickup_time, dropoff_time)")
    .eq("school_id", schoolId)
    .order("name")
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getTransportSubscriptions() {
  const { supabase, schoolId } = await getSchoolId()
  const { data, error } = await supabase
    .from("transport_subscriptions")
    .select(`
      id, status, start_date, end_date,
      enrollments (
        id,
        students ( first_name, last_name ),
        classes ( name )
      ),
      bus_routes ( name ),
      bus_stops ( name )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createBusRoute(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { error } = await supabase.from("bus_routes").insert({
    school_id: schoolId,
    name: formData.get("name") as string,
    driver_name: (formData.get("driver_name") as string) || null,
    driver_phone: (formData.get("driver_phone") as string) || null,
    vehicle_plate: (formData.get("vehicle_plate") as string) || null,
    capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null,
    monthly_fee_cfa: parseInt(formData.get("monthly_fee_cfa") as string) || 0,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function createTransportSubscription(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  // Resolve current academic year
  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle()

  const { error } = await supabase.from("transport_subscriptions").insert({
    school_id: schoolId,
    academic_year_id: year?.id || formData.get("academic_year_id") as string,
    enrollment_id: formData.get("enrollment_id") as string,
    route_id: formData.get("route_id") as string,
    stop_id: (formData.get("stop_id") as string) || null,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── CANTINE ─────────────────────────────────────────────────────────────────

export async function getCanteenMenus(dateFrom?: string, dateTo?: string) {
  const { supabase, schoolId } = await getSchoolId()
  const featureCheck = await requireFeature(supabase, schoolId, "canteen")
  if (featureCheck.error) return { error: featureCheck.error }
  let query = supabase
    .from("canteen_menus")
    .select("*")
    .eq("school_id", schoolId)
    .order("date", { ascending: true })
  if (dateFrom) query = query.gte("date", dateFrom)
  if (dateTo) query = query.lte("date", dateTo)
  const { data, error } = await query
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getCanteenSubscriptions() {
  const { supabase, schoolId } = await getSchoolId()
  const featureCheck = await requireFeature(supabase, schoolId, "canteen")
  if (featureCheck.error) return { error: featureCheck.error }
  const { data, error } = await supabase
    .from("canteen_subscriptions")
    .select(`
      id, plan_type, amount_cfa, status, start_date,
      enrollments (
        id,
        students ( first_name, last_name ),
        classes ( name )
      )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createCanteenMenu(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { error } = await supabase.from("canteen_menus").upsert({
    school_id: schoolId,
    date: formData.get("date") as string,
    meal_type: (formData.get("meal_type") as string) || "lunch",
    description: formData.get("description") as string,
  }, { onConflict: "school_id, date, meal_type" })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function createCanteenSubscription(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle()
  const { error } = await supabase.from("canteen_subscriptions").insert({
    school_id: schoolId,
    academic_year_id: year?.id || formData.get("academic_year_id") as string,
    enrollment_id: formData.get("enrollment_id") as string,
    plan_type: formData.get("plan_type") as string,
    amount_cfa: parseInt(formData.get("amount_cfa") as string) || 0,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── INTERNAT ─────────────────────────────────────────────────────────────────

export async function getDormitories() {
  const { supabase, schoolId } = await getSchoolId()
  const featureCheck = await requireFeature(supabase, schoolId, "boarding")
  if (featureCheck.error) return { error: featureCheck.error }
  const { data, error } = await supabase
    .from("dormitories")
    .select("*, dorm_rooms(id, room_number, capacity)")
    .eq("school_id", schoolId)
    .order("name")
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getBoardingSubscriptions() {
  const { supabase, schoolId } = await getSchoolId()
  const featureCheck = await requireFeature(supabase, schoolId, "boarding")
  if (featureCheck.error) return { error: featureCheck.error }
  const { data, error } = await supabase
    .from("boarding_subscriptions")
    .select(`
      id, status, start_date, amount_cfa,
      enrollments (
        id,
        students ( first_name, last_name ),
        classes ( name )
      ),
      dorm_rooms ( room_number, dormitories ( name ) )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createDormitory(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { error } = await supabase.from("dormitories").insert({
    school_id: schoolId,
    name: formData.get("name") as string,
    gender_restriction: formData.get("gender_restriction") as string,
    capacity: parseInt(formData.get("capacity") as string),
    supervisor_name: (formData.get("supervisor_name") as string) || null,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function createDormRoom(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { error } = await supabase.from("dorm_rooms").insert({
    school_id: schoolId,
    dormitory_id: formData.get("dormitory_id") as string,
    room_number: formData.get("room_number") as string,
    capacity: parseInt(formData.get("capacity") as string),
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function createBoardingSubscription(formData: FormData) {
  const { supabase, schoolId } = await getSchoolId()
  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle()
  const { error } = await supabase.from("boarding_subscriptions").insert({
    school_id: schoolId,
    academic_year_id: year?.id || formData.get("academic_year_id") as string,
    enrollment_id: formData.get("enrollment_id") as string,
    room_id: (formData.get("room_id") as string) || null,
    amount_cfa: parseInt(formData.get("amount_cfa") as string) || 0,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function getEnrollmentsForSelect() {
  const { supabase, schoolId } = await getSchoolId()
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, students( first_name, last_name ), classes( name )")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("students ( last_name )", { ascending: true })
  if (error) return { error: error.message }
  return { data: data || [] }
}
