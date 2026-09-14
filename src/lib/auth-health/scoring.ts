import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Auth health (miroir TS)
// ============================================================================

export type HealthStatus = 'healthy' | 'has_orphan_profiles' | 'has_incomplete_signups';
export type BanStatus = 'active' | 'banned' | 'ban_expired';
export type UserRole = 'admin' | 'professeur' | 'secretariat' | 'censeur' | 'parent';

export interface ProfileOrphanAuth {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  establishment_id: string | null;
  created_at: string;
}

export interface AuthUserNoProfile {
  id: string;
  email: string | null;
  auth_created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  is_banned: boolean;
  days_since_signup: number;
}

export interface DuplicateAccounts {
  email_normalized: string;
  account_count: number;
  user_ids: string[];
  roles: (UserRole | null)[] | null;
}

export interface AuthHealthSummary {
  consistent_accounts: number;
  orphan_profiles: number;
  auth_no_profile: number;
  total_profiles: number;
  total_auth_users: number;
  health_status: HealthStatus;
}

export interface BannedUser {
  id: string;
  email: string | null;
  banned_until: string | null;
  full_name: string | null;
  role: UserRole | null;
  establishment_id: string | null;
  status: BanStatus;
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
// Helpers purs
// ----------------------------------------------------------------------------

export function isAuthHealthy(s: AuthHealthSummary): boolean {
  return s.health_status === 'healthy';
}

export function hasOrphans(s: AuthHealthSummary): boolean {
  return s.orphan_profiles > 0;
}

export function healthLabel(s: HealthStatus): string {
  switch (s) {
    case 'healthy': return 'Sain';
    case 'has_orphan_profiles': return 'Profils orphelins';
    case 'has_incomplete_signups': return 'Inscriptions incomplètes';
  }
}

export function banLabel(s: BanStatus): string {
  switch (s) {
    case 'active': return 'Actif';
    case 'banned': return 'Banni';
    case 'ban_expired': return 'Sanction expirée';
  }
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchAuthHealthSummary(
  supabase: SupabaseClient
): Promise<AuthHealthSummary | null> {
  const { data, error } = await supabase
    .from('auth_health_summary')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[auth-health] summary error', error);
    return null;
  }
  return data;
}

export async function fetchProfileOrphans(
  supabase: SupabaseClient
): Promise<ProfileOrphanAuth[]> {
  const { data, error } = await supabase
    .from('profiles_orphan_auth')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[auth-health] orphans error', error);
    return [];
  }
  return (data ?? []) as ProfileOrphanAuth[];
}

export async function fetchIncompleteSignups(
  supabase: SupabaseClient
): Promise<AuthUserNoProfile[]> {
  const { data, error } = await supabase
    .from('auth_users_no_profile')
    .select('*')
    .order('auth_created_at', { ascending: false });

  if (error) {
    console.error('[auth-health] incomplete signups error', error);
    return [];
  }
  return (data ?? []) as AuthUserNoProfile[];
}

export async function fetchDuplicateAccounts(
  supabase: SupabaseClient
): Promise<DuplicateAccounts[]> {
  const { data, error } = await supabase
    .from('duplicate_accounts')
    .select('*')
    .order('account_count', { ascending: false });

  if (error) {
    console.error('[auth-health] duplicates error', error);
    return [];
  }
  return (data ?? []) as DuplicateAccounts[];
}

export async function fetchBannedUsers(
  supabase: SupabaseClient
): Promise<BannedUser[]> {
  const { data, error } = await supabase
    .from('banned_users')
    .select('*')
    .order('banned_until', { ascending: false });

  if (error) {
    console.error('[auth-health] banned error', error);
    return [];
  }
  return (data ?? []) as BannedUser[];
}

export async function auditAuthHealth(
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('audit_auth_health');

  if (error) {
    console.error('[auth-health] audit error', error);
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}

export async function cleanupOrphanProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('cleanup_orphan_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    console.error('[auth-health] cleanup error', error);
    return false;
  }
  return (data as boolean) ?? false;
}

// ----------------------------------------------------------------------------
// Sessions actives (auth_active_sessions + auth_sessions_summary)
// ----------------------------------------------------------------------------

export async function fetchActiveSessions(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 50
): Promise<AuthActiveSession[]> {
  const { data, error } = await supabase
    .from('auth_active_sessions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .limit(limit);

  if (error) {
    console.error('[auth-health] active sessions error', error);
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
    console.error('[auth-health] sessions summary error', error);
    return null;
  }
  return data;
}

export async function auditSessionsAndHealth(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('audit_sessions_and_health', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[auth-health] sessions audit error', error);
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}
