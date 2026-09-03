import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Secretariat intelligence (miroir TS)
// ============================================================================

export type CompletenessStatus = 'complete' | 'pending_validation' | 'incomplete';
export type FinalizationState = 'expired' | 'awaiting_payment' | 'awaiting_scan' | 'unknown';
export type ActionType = 'reservation_finalized' | 'payment_confirmed';

export interface StudentDocumentsCompleteness {
  student_id: string;
  establishment_id: string;
  full_name: string;
  section_name: string | null;
  required_total: number;
  required_validated: number;
  required_submitted: number;
  required_missing: number;
  completeness_pct: number;
  status: CompletenessStatus;
}

export interface PendingQRFinalization {
  reservation_id: string;
  establishment_id: string;
  qr_code_token: string;
  student_full_name: string;
  parent_full_name: string;
  parent_phone: string;
  amount_paid: number;
  reservation_status: string;
  expires_at: string | null;
  created_at: string;
  finalization_state: FinalizationState;
}

export interface SecretariatDailyActions {
  establishment_id: string;
  establishment_name: string;
  reservations_today: number;
  pending_payment_count: number;
  reserved_count: number;
  payments_today: number;
  payments_pending: number;
  pending_amount: number;
  students_with_incomplete_docs: number;
  total_pending_actions: number;
}

export interface SecretariatRecentAction {
  id: string;
  establishment_id: string;
  action_type: ActionType;
  target_name: string;
  actor_id: string | null;
  action_at: string;
  metadata: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function completenessLabel(status: CompletenessStatus): string {
  switch (status) {
    case 'complete': return 'Complet';
    case 'pending_validation': return 'En attente de validation';
    case 'incomplete': return 'Incomplet';
  }
}

export function completenessColor(status: CompletenessStatus): string {
  switch (status) {
    case 'complete': return 'green';
    case 'pending_validation': return 'amber';
    case 'incomplete': return 'red';
  }
}

export function isWorkloadCritical(row: SecretariatDailyActions): boolean {
  return row.total_pending_actions >= 20;
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchSecretariatDailyActions(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<SecretariatDailyActions | null> {
  const { data, error } = await supabase
    .from('secretariat_daily_actions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[secretariat-intelligence] daily actions error', error);
    return null;
  }
  return data;
}

export async function fetchStudentsMissingDocuments(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 20
): Promise<StudentDocumentsCompleteness[]> {
  const { data, error } = await supabase
    .from('students_missing_documents')
    .select('*')
    .eq('establishment_id', establishmentId)
    .limit(limit);

  if (error) {
    console.error('[secretariat-intelligence] missing docs error', error);
    return [];
  }
  return (data ?? []) as StudentDocumentsCompleteness[];
}

export async function fetchPendingQRFinalizations(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 50
): Promise<PendingQRFinalization[]> {
  const { data, error } = await supabase
    .from('pending_qr_finalizations')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[secretariat-intelligence] pending QR error', error);
    return [];
  }
  return (data ?? []) as PendingQRFinalization[];
}

export async function fetchSecretariatRecentActions(
  supabase: SupabaseClient,
  establishmentId: string,
  limit = 30
): Promise<SecretariatRecentAction[]> {
  const { data, error } = await supabase
    .from('secretariat_recent_actions')
    .select('*')
    .eq('establishment_id', establishmentId)
    .order('action_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[secretariat-intelligence] recent actions error', error);
    return [];
  }
  return (data ?? []) as SecretariatRecentAction[];
}

export async function finalizeReservation(
  supabase: SupabaseClient,
  reservationId: string,
  sectionId?: string | null,
  actorId?: string | null
): Promise<{ reservation_id: string; student_id: string; section_id: string } | null> {
  const { data, error } = await supabase.rpc('finalize_reservation', {
    p_reservation_id: reservationId,
    p_section_id: sectionId ?? null,
    p_actor_id: actorId ?? null,
  });

  if (error) {
    console.error('[secretariat-intelligence] finalize error', error);
    return null;
  }
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

export async function computeEstablishmentDocsCompleteness(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('compute_establishment_docs_completeness', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[secretariat-intelligence] docs completeness error', error);
    return 100;
  }
  return (data as number) ?? 100;
}
