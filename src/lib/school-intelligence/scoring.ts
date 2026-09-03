import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — School health intelligence (miroir TS de school_health_overview)
// ============================================================================

export type SchoolType = 'primaire' | 'college' | 'lycee' | 'professionnel' | 'islamique' | null;

export type StaffingStatus = 'complete' | 'missing_admin' | 'missing_teachers' | 'missing_secretariat';

export interface SchoolHealthOverview {
  establishment_id: string;
  establishment_name: string;
  city: string;
  school_type: SchoolType;

  // Auth / sécurité
  auth_users_total: number;
  auth_active_sessions_24h: number;
  auth_orphan_profiles: number;
  auth_banned_users: number;
  auth_duplicate_account_groups: number;

  // Équipe
  staff_total: number;
  staff_admin_count: number;
  staff_teacher_count: number;
  staff_secretariat_count: number;
  staff_censeur_count: number;
  parent_count: number;

  // Réservations
  res_pending_payment_count: number;
  res_reserved_count: number;
  res_confirmed_count: number;
  res_expired_count: number;
  res_cancelled_count: number;
  res_waitlisted_count: number;
  res_rejected_fraud_count: number;
  res_total_count: number;
  res_avg_parent_trust_score: number;
  res_high_fraud_risk_count: number;
  res_waitlist_max_position: number;

  // Classes
  total_sections: number;
  total_capacity: number;
  total_seats_taken: number;
  fill_rate_pct: number;
  total_seats_available: number;
  full_sections_count: number;
  low_fill_sections_count: number;
  total_levels: number;

  // Élèves
  students_total: number;
  students_new_30d: number;
  students_new_7d: number;
  students_avg_age: number;

  // Paiements
  pay_total_collected: number;
  pay_total_pending: number;
  pay_total_remaining: number;
  pay_recovery_rate_pct: number;
  pay_confirmed_count: number;
  pay_pending_count: number;
  pay_failed_count: number;
  fees_overdue_count: number;
  pay_high_risk_count: number;

  // Documents
  docs_avg_completeness_pct: number;
  docs_total_required: number;
  docs_total_validated: number;
  docs_total_missing: number;
  docs_students_incomplete: number;

  // Notes / évaluation
  grades_total_count: number;
  grades_overall_average: number;
  grades_avg_30d: number;
  grades_recorded_7d: number;

  // Élèves à risque
  students_at_risk_count: number;
  students_at_risk_high: number;
  students_at_risk_medium: number;

  // Comportement
  beh_total_notes_30d: number;
  beh_incidents_30d: number;
  beh_a_surveiller_30d: number;

  // Messages
  msg_total_30d: number;
  msg_unread_count: number;
  msg_read_rate_pct: number | null;

  // Présence
  att_total_records_30d: number;
  att_present_count_30d: number;
  att_absent_count_30d: number;
  att_rate_pct_30d: number | null;

  // Internat
  int_total_beds: number;
  int_occupied_beds: number;
  int_free_beds: number;
  int_occupancy_rate_pct: number;
  int_incidents_7d: number;
  int_incidents_30d: number;
  int_grave_open_incidents: number;
  int_visits_today: number;

  // Secrétariat
  sec_total_pending_actions: number;
  sec_students_incomplete_docs: number;
  sec_pending_payment_count: number;
  sec_reservations_today: number;

  // Onboarding global
  students_by_level: Record<string, number> | null;
}

export interface AuthActiveSession {
  user_id: string;
  establishment_id: string;
  establishment_name: string;
  full_name: string;
  role: string;
  email: string;
  auth_created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  is_banned: boolean;
  hours_since_last_sign_in: number;
}

export interface AuthSessionsSummary {
  establishment_id: string;
  establishment_name: string;
  total_users: number;
  active_users_24h: number;
  active_users_7d: number;
  staff_active_24h: number;
  parents_active_24h: number;
  activity_rate_pct: number;
}

// ----------------------------------------------------------------------------
// Health score classification
// ----------------------------------------------------------------------------

export type HealthLevel = 'critical' | 'warning' | 'healthy';
export type RiskLevel = 'high' | 'medium' | 'low';

export function healthScoreLabel(score: number): string {
  if (score >= 80) return 'Sain';
  if (score >= 60) return 'Moyen';
  if (score >= 40) return 'Fragile';
  return 'Critique';
}

export function healthScoreColor(score: number): HealthLevel {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
}

export function isHealthy(score: number): boolean {
  return score >= 70;
}

// ----------------------------------------------------------------------------
// Reservation funnel helpers
// ----------------------------------------------------------------------------

export function reservationConfirmationRate(r: SchoolHealthOverview): number {
  const funnelTotal =
    r.res_pending_payment_count +
    r.res_reserved_count +
    r.res_confirmed_count;
  if (funnelTotal === 0) return 0;
  return Math.round((100 * r.res_confirmed_count) / funnelTotal);
}

export function reservationNoShowRate(r: SchoolHealthOverview): number {
  if (r.res_reserved_count === 0) return 0;
  return Math.round((100 * r.res_expired_count) / r.res_reserved_count);
}

// ----------------------------------------------------------------------------
// Capacity helpers
// ----------------------------------------------------------------------------

export function capacityUtilization(r: SchoolHealthOverview): number {
  if (r.total_capacity === 0) return 0;
  return Math.round((100 * r.total_seats_taken) / r.total_capacity);
}

export function hasCapacityPressure(r: SchoolHealthOverview): boolean {
  return r.full_sections_count > 0 || r.fill_rate_pct >= 95;
}

// ----------------------------------------------------------------------------
// Payment helpers
// ----------------------------------------------------------------------------

export function paymentRiskLabel(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function hasPaymentIssues(r: SchoolHealthOverview): boolean {
  return (
    r.fees_overdue_count > 0 ||
    r.pay_high_risk_count > 0 ||
    r.pay_total_remaining > 0
  );
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchSchoolHealthOverview(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<SchoolHealthOverview | null> {
  const { data, error } = await supabase
    .from('school_health_overview')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[school-intelligence] overview error', error);
    return null;
  }
  return data as SchoolHealthOverview | null;
}

export async function fetchAllSchoolHealth(
  supabase: SupabaseClient
): Promise<SchoolHealthOverview[]> {
  const { data, error } = await supabase
    .from('school_health_overview')
    .select('*')
    .order('establishment_name');

  if (error) {
    console.error('[school-intelligence] ranking error', error);
    return [];
  }
  return (data ?? []) as SchoolHealthOverview[];
}

export async function fetchSchoolHealthRanking(
  supabase: SupabaseClient
): Promise<SchoolHealthOverview[]> {
  const { data, error } = await supabase
    .from('school_health_ranking')
    .select('*')
    .order('health_score', { ascending: false });

  if (error) {
    console.error('[school-intelligence] ranking error', error);
    return [];
  }
  return (data ?? []) as SchoolHealthOverview[];
}

export async function fetchActiveSessions(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<AuthActiveSession[]> {
  const { data, error } = await supabase
    .from('auth_active_sessions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .limit(50);

  if (error) {
    console.error('[school-intelligence] active sessions error', error);
    return [];
  }
  return (data ?? []) as AuthActiveSession[];
}

export async function fetchAuthSessionsSummary(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<AuthSessionsSummary | null> {
  const { data, error } = await supabase
    .from('auth_sessions_summary')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[school-intelligence] sessions summary error', error);
    return null;
  }
  return data as AuthSessionsSummary | null;
}

export async function computeSchoolHealthScore(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('compute_school_health_score', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[school-intelligence] health score error', error);
    return 0;
  }
  return (data as number) ?? 0;
}

export async function generateSchoolHealthReport(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('school_health_report', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[school-intelligence] health report error', error);
    return null;
  }
  return data as Record<string, unknown> | null;
}
