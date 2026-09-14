import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Messagerie intelligence (miroir TS)
// ============================================================================

export type EngagementLevel = 'no_data' | 'low_engagement' | 'normal' | 'engaged';
export type UrgencySource = 'keyword' | 'keyword_subject' | 'late_only';

export interface MessagesUnreadSummary {
  recipient_id: string;
  recipient_name: string;
  recipient_role: string;
  establishment_id: string;
  unread_count: number;
  last_unread_at: string;
}

export interface MessagesActivityDashboard {
  establishment_id: string;
  establishment_name: string;
  total_messages: number;
  messages_24h: number;
  messages_7d: number;
  messages_30d: number;
  read_count: number;
  unread_count: number;
  read_rate_pct: number | null;
  late_reads: number;
  unanswered_48h: number;
}

export interface MessagesThread {
  establishment_id: string;
  user_a: string;
  user_b: string;
  user_a_name: string | null;
  user_b_name: string | null;
  last_message_id: string;
  subject: string;
  last_body: string;
  last_read_at: string | null;
  last_message_at: string;
  last_sender_id: string;
  has_unread_for_me: boolean;
}

export interface MessagesEngagement {
  user_id: string;
  establishment_id: string;
  full_name: string;
  role: string;
  total_received: number;
  total_read: number;
  total_unread: number;
  read_rate_pct: number | null;
  engagement_level: EngagementLevel;
}

export interface MessagesUnansweredUrgent {
  id: string;
  establishment_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  recipient_name: string | null;
  student_id: string | null;
  student_name: string | null;
  subject: string;
  body: string;
  created_at: string;
  hours_since_sent: number;
  urgency_source: UrgencySource;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function isEngaged(level: EngagementLevel): boolean {
  return level === 'engaged';
}

export function engagementLabel(level: EngagementLevel): string {
  switch (level) {
    case 'engaged': return 'Engagé';
    case 'normal': return 'Normal';
    case 'low_engagement': return 'Faible';
    case 'no_data': return 'Aucune donnée';
  }
}

export function urgencyLabel(source: UrgencySource): string {
  switch (source) {
    case 'keyword': return 'Corps du message';
    case 'keyword_subject': return 'Sujet';
    case 'late_only': return 'En retard';
  }
}

export function isUrgencyCritical(hours: number): boolean {
  return hours >= 72;
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchMessagesUnreadSummary(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<MessagesUnreadSummary[]> {
  const { data, error } = await supabase
    .from('messages_unread_summary')
    .select('*')
    .eq('establishment_id', establishmentId);

  if (error) {
    console.error('[messages-intelligence] unread summary error', error);
    return [];
  }
  return (data ?? []) as MessagesUnreadSummary[];
}

export async function fetchMessagesActivityDashboard(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<MessagesActivityDashboard | null> {
  const { data, error } = await supabase
    .from('messages_activity_dashboard')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[messages-intelligence] activity dashboard error', error);
    return null;
  }
  return data;
}

export async function fetchMessagesThreads(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<MessagesThread[]> {
  const { data, error } = await supabase
    .from('messages_threads')
    .select('*')
    .eq('establishment_id', establishmentId);

  if (error) {
    console.error('[messages-intelligence] threads error', error);
    return [];
  }
  return (data ?? []) as MessagesThread[];
}

export async function fetchMessagesEngagement(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<MessagesEngagement[]> {
  const { data, error } = await supabase
    .from('messages_engagement')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('read_rate_pct', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[messages-intelligence] engagement error', error);
    return [];
  }
  return (data ?? []) as MessagesEngagement[];
}

export async function fetchMessagesUnansweredUrgent(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<MessagesUnansweredUrgent[]> {
  const { data, error } = await supabase
    .from('messages_unanswered_urgent')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[messages-intelligence] urgent unanswered error', error);
    return [];
  }
  return (data ?? []) as MessagesUnansweredUrgent[];
}

export async function markMessagesRead(
  supabase: SupabaseClient,
  messageIds: string[],
  readerId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('mark_messages_read', {
    p_message_ids: messageIds,
    p_reader_id: readerId,
  });

  if (error) {
    console.error('[messages-intelligence] mark read error', error);
    return 0;
  }
  return (data as number) ?? 0;
}
