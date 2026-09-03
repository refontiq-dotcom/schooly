import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Team intelligence (miroir TS)
// ============================================================================

export type ActivityStatus = 'active' | 'low_activity' | 'inactive' | 'critical' | 'never';
export type StaffingStatus = 'complete' | 'missing_admin' | 'missing_teachers' | 'missing_secretariat';
export type ParentEngagement = 'no_children' | 'silent' | 'normal' | 'engaged';
export type UserRole = 'admin' | 'professeur' | 'secretariat' | 'censeur' | 'parent';

export interface TeamOverview {
  establishment_id: string;
  role: UserRole;
  member_count: number;
  new_members_30d: number;
  new_members_7d: number;
}

export interface TeamInactiveMember {
  user_id: string;
  establishment_id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_action_at: string | null;
  days_inactive: number | null;
  activity_status: ActivityStatus;
}

export interface TeamEstablishmentStats {
  establishment_id: string;
  establishment_name: string;
  admin_count: number;
  teacher_count: number;
  secretariat_count: number;
  censeur_count: number;
  parent_count: number;
  total_members: number;
  students_count: number;
  students_per_teacher_ratio: number | null;
  staffing_status: StaffingStatus;
}

export interface TeamParentEngagement {
  parent_id: string;
  establishment_id: string;
  parent_name: string;
  email: string | null;
  phone: string | null;
  children_count: number;
  messages_received: number;
  messages_read: number;
  payments_confirmed: number;
  engagement_level: ParentEngagement;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function isCritical(s: ActivityStatus): boolean {
  return s === 'critical' || s === 'inactive';
}

export function staffingLabel(s: StaffingStatus): string {
  switch (s) {
    case 'complete': return 'Complet';
    case 'missing_admin': return 'Admin manquant';
    case 'missing_teachers': return 'Aucun prof';
    case 'missing_secretariat': return 'Secrétariat manquant';
  }
}

export function parentEngagementLabel(p: ParentEngagement): string {
  switch (p) {
    case 'engaged': return 'Engagé';
    case 'normal': return 'Normal';
    case 'silent': return 'Silencieux';
    case 'no_children': return 'Aucun enfant';
  }
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchTeamOverview(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TeamOverview[]> {
  const { data, error } = await supabase
    .from('team_overview')
    .select('*')
    .eq('establishment_id', establishmentId);

  if (error) {
    console.error('[team-intelligence] overview error', error);
    return [];
  }
  return (data ?? []) as TeamOverview[];
}

export async function fetchTeamInactiveMembers(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TeamInactiveMember[]> {
  const { data, error } = await supabase
    .from('team_inactive_members')
    .select('*')
    .eq('establishment_id', establishmentId)
    .in('activity_status', ['inactive', 'critical', 'low_activity'])
    .order('days_inactive', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[team-intelligence] inactive error', error);
    return [];
  }
  return (data ?? []) as TeamInactiveMember[];
}

export async function fetchTeamEstablishmentStats(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TeamEstablishmentStats | null> {
  const { data, error } = await supabase
    .from('team_establishment_stats')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[team-intelligence] est stats error', error);
    return null;
  }
  return data;
}

export async function fetchTeamParentEngagement(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TeamParentEngagement[]> {
  const { data, error } = await supabase
    .from('team_parent_engagement')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('engagement_level', { ascending: true });

  if (error) {
    console.error('[team-intelligence] parent engagement error', error);
    return [];
  }
  return (data ?? []) as TeamParentEngagement[];
}

export async function exportTeamSummary(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('export_team_summary', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[team-intelligence] export error', error);
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}
