import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Teacher intelligence v2 (miroir TS)
// ============================================================================

export type WorkloadLevel = 'none' | 'low' | 'normal' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface TeacherMyClass {
  teacher_id: string;
  establishment_id: string;
  section_id: string;
  section_name: string;
  level_name: string;
  capacity: number;
  seats_taken: number;
  subject: string;
  subject_average: number;
  total_grades_subject: number;
  grades_last_7d: number;
  is_homeroom: boolean;
}

export interface TeacherAtRiskStudent {
  teacher_id: string;
  student_id: string;
  full_name: string;
  section_id: string;
  section_name: string;
  current_average: number;
  latest_2_avg: number | null;
  previous_2_avg: number | null;
  attendance_pct_30d: number | null;
  alert_level: RiskLevel | null;
  reasons: string[] | null;
}

export interface TeacherWorkloadSummary {
  teacher_id: string;
  establishment_id: string;
  teacher_name: string;
  classes_count: number;
  subjects_count: number;
  class_subject_pairs: number;
  homeroom_students: number;
  grades_recorded_7d: number;
  attendance_records_7d: number;
  workload_level: WorkloadLevel;
}

export interface TeacherHomeroomOverview {
  teacher_id: string;
  establishment_id: string;
  section_id: string;
  section_name: string;
  level_name: string;
  capacity: number;
  seats_taken: number;
  students_count: number;
  class_average: number;
  at_risk_count: number;
}

export interface TeacherClassesComparison {
  teacher_id: string;
  subject: string;
  section_id: string;
  section_name: string;
  level_name: string;
  capacity: number;
  seats_taken: number;
  subject_average: number;
  global_section_average: number;
  std_deviation: number;
  subject_vs_global_diff: number;
}

export interface TeacherPendingGrade {
  teacher_id: string;
  section_id: string;
  section_name: string;
  subject: string;
  session_date: string;
  days_ago: number;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function workloadLabel(level: WorkloadLevel): string {
  switch (level) {
    case 'high': return 'Charge élevée';
    case 'normal': return 'Charge normale';
    case 'low': return 'Charge faible';
    default: return 'Aucune classe';
  }
}

export function isWorkloadHigh(w: TeacherWorkloadSummary): boolean {
  return w.workload_level === 'high';
}

export function pendingGradeUrgency(daysAgo: number): 'urgent' | 'soon' | 'ok' {
  if (daysAgo >= 8) return 'urgent';
  if (daysAgo >= 5) return 'soon';
  return 'ok';
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchTeacherMyClasses(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherMyClass[]> {
  const { data, error } = await supabase
    .from('teacher_my_classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('level_name, section_name, subject');

  if (error) {
    console.error('[teacher-v2] my classes error', error);
    return [];
  }
  return (data ?? []) as TeacherMyClass[];
}

export async function fetchTeacherAtRiskStudents(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherAtRiskStudent[]> {
  const { data, error } = await supabase
    .from('teacher_my_at_risk_students')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('alert_level', { ascending: false });

  if (error) {
    console.error('[teacher-v2] at risk students error', error);
    return [];
  }
  return (data ?? []) as TeacherAtRiskStudent[];
}

export async function fetchTeacherWorkload(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherWorkloadSummary | null> {
  const { data, error } = await supabase
    .from('teacher_workload_summary')
    .select('*')
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (error) {
    console.error('[teacher-v2] workload error', error);
    return null;
  }
  return data;
}

export async function fetchTeacherHomeroom(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherHomeroomOverview[]> {
  const { data, error } = await supabase
    .from('teacher_homeroom_overview')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('level_name, section_name');

  if (error) {
    console.error('[teacher-v2] homeroom error', error);
    return [];
  }
  return (data ?? []) as TeacherHomeroomOverview[];
}

export async function fetchTeacherClassesComparison(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherClassesComparison[]> {
  const { data, error } = await supabase
    .from('teacher_classes_comparison')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('subject_average', { ascending: false });

  if (error) {
    console.error('[teacher-v2] classes comparison error', error);
    return [];
  }
  return (data ?? []) as TeacherClassesComparison[];
}

export async function fetchTeacherPendingGrades(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherPendingGrade[]> {
  const { data, error } = await supabase
    .from('teacher_pending_grades')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('session_date', { ascending: false });

  if (error) {
    console.error('[teacher-v2] pending grades error', error);
    return [];
  }
  return (data ?? []) as TeacherPendingGrade[];
}

export async function computeTeacherGlobalAverage(
  supabase: SupabaseClient,
  teacherId: string,
  days = 90
): Promise<number> {
  const { data, error } = await supabase.rpc('compute_teacher_global_average', {
    p_teacher_id: teacherId,
    p_days: days,
  });

  if (error) {
    console.error('[teacher-v2] global average error', error);
    return 0;
  }
  return (data as number) ?? 0;
}
