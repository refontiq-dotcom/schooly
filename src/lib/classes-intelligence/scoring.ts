import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Classes intelligence (miroir TS des vues SQL)
// ============================================================================

export type FillStatus = 'unknown' | 'low' | 'normal' | 'almost_full' | 'full';
export type AlertLevel = 'ok' | 'info' | 'warning' | 'critical';
export type WorkloadLevel = 'none' | 'low' | 'normal' | 'high';

export interface ClassSectionFillRate {
  section_id: string;
  level_id: string;
  establishment_id: string;
  level_name: string;
  section_name: string;
  capacity: number;
  seats_taken: number;
  fill_rate_pct: number;
  seats_available: number;
  fill_status: FillStatus;
}

export interface ClassLevelFillRate {
  level_id: string;
  establishment_id: string;
  level_name: string;
  rank: number;
  sections_count: number;
  total_capacity: number;
  total_taken: number;
  fill_rate_pct: number;
  seats_available: number;
  fill_status: FillStatus;
}

export interface ClassBalanceAlert {
  section_id: string;
  level_id: string;
  establishment_id: string;
  level_name: string;
  section_name: string;
  fill_rate_pct: number;
  fill_status: FillStatus;
  seats_available: number;
  alert_level: AlertLevel;
}

export interface ClassCapacitySummary {
  establishment_id: string;
  establishment_name: string;
  total_sections: number;
  total_capacity: number;
  total_taken: number;
  global_fill_rate_pct: number;
  total_seats_available: number;
  full_levels: number;
  low_levels: number;
  normal_levels: number;
}

export interface ClassTeacherWorkload {
  teacher_id: string;
  establishment_id: string;
  teacher_name: string;
  homeroom_sections: number;
  homeroom_capacity: number;
  homeroom_students: number;
  workload_level: WorkloadLevel;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function isAlertCritical(alert: ClassBalanceAlert): boolean {
  return alert.alert_level === 'critical';
}

export function summarizeFillStatus(rate: number): FillStatus {
  if (rate >= 100) return 'full';
  if (rate >= 90) return 'almost_full';
  if (rate < 50) return 'low';
  return 'normal';
}

export function colorForFillStatus(status: FillStatus): string {
  switch (status) {
    case 'full': return 'red';
    case 'almost_full': return 'orange';
    case 'low': return 'amber';
    case 'normal': return 'green';
    default: return 'slate';
  }
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchClassCapacitySummary(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<ClassCapacitySummary | null> {
  const { data, error } = await supabase
    .from('class_capacity_summary')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[classes-intelligence] capacity summary error', error);
    return null;
  }
  return data;
}

export async function fetchClassLevelFillRates(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<ClassLevelFillRate[]> {
  const { data, error } = await supabase
    .from('class_level_fill_rates')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('rank');

  if (error) {
    console.error('[classes-intelligence] level fill rates error', error);
    return [];
  }
  return (data ?? []) as ClassLevelFillRate[];
}

export async function fetchClassSectionFillRates(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<ClassSectionFillRate[]> {
  const { data, error } = await supabase
    .from('class_section_fill_rates')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('level_name, section_name');

  if (error) {
    console.error('[classes-intelligence] section fill rates error', error);
    return [];
  }
  return (data ?? []) as ClassSectionFillRate[];
}

export async function fetchClassBalanceAlerts(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<ClassBalanceAlert[]> {
  const { data, error } = await supabase
    .from('class_balance_alerts')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('alert_level', { ascending: false });

  if (error) {
    console.error('[classes-intelligence] balance alerts error', error);
    return [];
  }
  return (data ?? []) as ClassBalanceAlert[];
}

export async function fetchTeacherWorkload(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<ClassTeacherWorkload[]> {
  const { data, error } = await supabase
    .from('class_teacher_workload')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('homeroom_sections', { ascending: false });

  if (error) {
    console.error('[classes-intelligence] teacher workload error', error);
    return [];
  }
  return (data ?? []) as ClassTeacherWorkload[];
}

export async function suggestSectionForLevel(
  supabase: SupabaseClient,
  levelId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('suggest_section_for_level', {
    p_level_id: levelId,
  });

  if (error) {
    console.error('[classes-intelligence] suggest section error', error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function computeLevelFillRate(
  supabase: SupabaseClient,
  levelId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc('compute_level_fill_rate', {
    p_level_id: levelId,
  });

  if (error) {
    console.error('[classes-intelligence] level fill rate error', error);
    return null;
  }
  return (data as number | null) ?? null;
}
