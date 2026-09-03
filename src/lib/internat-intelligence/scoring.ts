import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Internat intelligence (miroir TS des vues SQL)
// ============================================================================
// Fonctions de scoring/format alignées sur les vues SQL créées dans la
// migration 20260903130000_internat_intelligence.sql
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface InternatDashboardRow {
  establishment_id: string;
  establishment_name: string;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
  maintenance_beds: number;
  occupancy_rate_pct: number;
  incidents_7d: number;
  incidents_30d: number;
  grave_open_incidents: number;
  visits_today: number;
}

export interface InternatStudentAtRisk {
  student_id: string;
  establishment_id: string;
  full_name: string;
  section_name: string | null;
  block_name: string | null;
  room_number: string | null;
  incidents_mineur: number;
  incidents_majeur: number;
  incidents_grave: number;
  incidents_open: number;
  last_incident_date: string | null;
  last_grave_open_date: string | null;
  risk_level: RiskLevel;
}

export interface InternatHealthRow {
  student_id: string;
  establishment_id: string;
  full_name: string;
  last_check_date: string | null;
  avg_temp_30d: number | null;
  checks_30d: number;
  fever_episodes_7d: number;
  on_medication_7d: number;
  has_recent_fever: boolean;
  needs_check: boolean;
}

export interface InternatMealCoverageRow {
  establishment_id: string;
  meal_date: string;
  meal_type: string;
  attendance_count: number;
  present_count: number;
  absent_count: number;
  presence_rate_pct: number | null;
}

export interface InternatOccupancyTrendRow {
  day: string;
  establishment_id: string;
  occupied_beds: number;
}

// ----------------------------------------------------------------------------
// Helpers de calcul (côté client — miroir des vues SQL)
// ----------------------------------------------------------------------------

export function computeRiskLevel(args: {
  openGrave: number;
  incidents30d: number;
  serious30d: number;
}): RiskLevel {
  if (args.openGrave > 0) return 'critical';
  if (args.incidents30d >= 3) return 'high';
  if (args.serious30d >= 2) return 'medium';
  return 'low';
}

export function summarizeOccupancy(row: InternatDashboardRow): string {
  return `${row.occupied_beds}/${row.total_beds} (${row.occupancy_rate_pct}%)`;
}

export function isDashboardCritical(row: InternatDashboardRow): boolean {
  return row.grave_open_incidents > 0;
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchInternatDashboard(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<InternatDashboardRow | null> {
  const { data, error } = await supabase
    .from('internat_dashboard')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[internat-intelligence] dashboard error', error);
    return null;
  }
  return data;
}

export async function fetchStudentsAtRisk(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<InternatStudentAtRisk[]> {
  const { data, error } = await supabase
    .from('internat_students_at_risk')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('risk_level', { ascending: false });

  if (error) {
    console.error('[internat-intelligence] students at risk error', error);
    return [];
  }
  return (data ?? []) as InternatStudentAtRisk[];
}

export async function fetchHealthSummary(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<InternatHealthRow[]> {
  const { data, error } = await supabase
    .from('internat_health_summary')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('last_check_date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[internat-intelligence] health summary error', error);
    return [];
  }
  return (data ?? []) as InternatHealthRow[];
}

export async function fetchMealCoverage(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 30
): Promise<InternatMealCoverageRow[]> {
  const { data, error } = await supabase
    .from('internat_meal_coverage')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('meal_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[internat-intelligence] meal coverage error', error);
    return [];
  }
  return (data ?? []) as InternatMealCoverageRow[];
}

export async function fetchOccupancyTrends(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<InternatOccupancyTrendRow[]> {
  const { data, error } = await supabase
    .from('internat_occupancy_trends')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('day', { ascending: true });

  if (error) {
    console.error('[internat-intelligence] occupancy trends error', error);
    return [];
  }
  return (data ?? []) as InternatOccupancyTrendRow[];
}

export async function suggestBedAssignment(
  supabase: SupabaseClient,
  studentId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('suggest_bed_assignment', {
    p_student_id: studentId,
  });

  if (error) {
    console.error('[internat-intelligence] suggest bed error', error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function computeAttendanceRate(
  supabase: SupabaseClient,
  studentId: string,
  days = 30
): Promise<number | null> {
  const { data, error } = await supabase.rpc('compute_student_attendance_rate', {
    p_student_id: studentId,
    p_days: days,
  });

  if (error) {
    console.error('[internat-intelligence] attendance rate error', error);
    return null;
  }
  return (data as number | null) ?? null;
}
