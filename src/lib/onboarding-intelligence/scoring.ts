import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Onboarding intelligence (miroir TS)
// ============================================================================

export interface OnboardingProgress {
  establishment_id: string;
  name: string;
  created_at: string;
  steps_completed: number;
  steps_total: number;
  completion_pct: number;
  has_description: 0 | 1;
  has_cover: 0 | 1;
  has_tour: 0 | 1;
  has_fee_config: 0 | 1;
  has_levels: 0 | 1;
  has_sections: 0 | 1;
  has_teachers: 0 | 1;
  has_staff: 0 | 1;
  has_students: 0 | 1;
  is_published: 0 | 1;
  next_step: string;
}

export interface EstablishmentsByType {
  school_type: string;
  total: number;
  published_count: number;
  new_30d: number;
  total_students: number;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function isFullyOnboarded(p: OnboardingProgress): boolean {
  return p.completion_pct === 100;
}

export function getOnboardingStatus(p: OnboardingProgress): 'complete' | 'in_progress' | 'pending' {
  if (p.completion_pct === 100) return 'complete';
  if (p.completion_pct === 0) return 'pending';
  return 'in_progress';
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchOnboardingProgress(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<OnboardingProgress | null> {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[onboarding-intelligence] progress error', error);
    return null;
  }
  return data;
}

export async function fetchIncompleteEstablishments(
  supabase: SupabaseClient
): Promise<OnboardingProgress[]> {
  const { data, error } = await supabase
    .from('establishments_incomplete')
    .select('*')
    .order('completion_pct', { ascending: true });

  if (error) {
    console.error('[onboarding-intelligence] incomplete error', error);
    return [];
  }
  return (data ?? []) as OnboardingProgress[];
}

export async function fetchEstablishmentsByType(
  supabase: SupabaseClient
): Promise<EstablishmentsByType[]> {
  const { data, error } = await supabase
    .from('establishments_by_type')
    .select('*');

  if (error) {
    console.error('[onboarding-intelligence] by type error', error);
    return [];
  }
  return (data ?? []) as EstablishmentsByType[];
}

export async function createEstablishmentWithAdmin(
  supabase: SupabaseClient,
  params: {
    name: string;
    city: string;
    school_type?: string | null;
    description?: string | null;
    address?: string | null;
    reservation_fee_amount?: number;
    actor_id?: string | null;
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_establishment_with_admin', {
    p_name: params.name,
    p_city: params.city,
    p_school_type: params.school_type ?? null,
    p_description: params.description ?? null,
    p_address: params.address ?? null,
    p_reservation_fee_amount: params.reservation_fee_amount ?? 0,
    p_actor_id: params.actor_id ?? null,
  });

  if (error) {
    console.error('[onboarding-intelligence] create error', error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function computeOnboardingCompletion(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('compute_onboarding_completion', {
    p_establishment_id: establishmentId,
  });

  if (error) {
    console.error('[onboarding-intelligence] completion error', error);
    return 0;
  }
  return (data as number) ?? 0;
}
