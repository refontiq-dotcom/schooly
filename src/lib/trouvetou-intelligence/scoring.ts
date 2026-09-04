import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHOOLY v1 — Trouvetou intelligence (miroir TS)
// ============================================================================

export interface TrouvetouPublicCatalog {
  establishment_id: string;
  name: string;
  city: string | null;
  school_type: string | null;
  published_to_trouvetou: boolean;
  reservation_hold_hours: number | null;
  levels_count: number;
  sections_count: number;
  total_seats_available: number;
  level_names: string[] | null;
}

export interface TrouvetouPerformance {
  establishment_id: string;
  establishment_name: string;
  city: string | null;
  published_to_trouvetou: boolean;
  source: string;
  total_reservations: number;
  trouvetou_reservations: number;
  confirmed_reservations: number;
  expired_reservations: number;
  cancelled_reservations: number;
  total_revenue: number;
  reservations_30d: number;
  trouvetou_30d: number;
}

export interface TrouvetouAdsPerformance {
  establishment_id: string;
  establishment_name: string;
  total_ads: number;
  active_ads: number;
  currently_live_ads: number;
  expired_ads: number;
  scheduled_ads: number;
  next_start: string | null;
  latest_end: string | null;
}

export interface TrouvetouConversionFunnel {
  establishment_id: string;
  establishment_name: string;
  total_reservations: number;
  trouvetou_received: number;
  trouvetou_awaiting_payment: number;
  trouvetou_confirmed: number;
  trouvetou_expired: number;
  conversion_rate_pct: number | null;
  expiry_rate_pct: number | null;
}

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

export function isConversionGood(rate: number | null): boolean {
  return rate !== null && rate >= 50;
}

export function isAdsLive(p: TrouvetouAdsPerformance): boolean {
  return p.currently_live_ads > 0;
}

export function conversionLabel(rate: number | null): string {
  if (rate === null) return 'N/A';
  if (rate >= 70) return 'Excellent';
  if (rate >= 50) return 'Bon';
  if (rate >= 25) return 'Moyen';
  return 'Faible';
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

export async function fetchTrouvetouPublicCatalog(
  supabase: SupabaseClient
): Promise<TrouvetouPublicCatalog[]> {
  const { data, error } = await supabase
    .from('trouvetou_public_catalog')
    .select('*')
    .order('name');

  if (error) {
    console.error('[trouvetou-intelligence] public catalog error', error);
    return [];
  }
  return (data ?? []) as TrouvetouPublicCatalog[];
}

export async function fetchTrouvetouPerformance(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TrouvetouPerformance[]> {
  const { data, error } = await supabase
    .from('trouvetou_performance')
    .select('*')
    .eq('establishment_id', establishmentId);

  if (error) {
    console.error('[trouvetou-intelligence] performance error', error);
    return [];
  }
  return (data ?? []) as TrouvetouPerformance[];
}

export async function fetchTrouvetouAdsPerformance(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TrouvetouAdsPerformance | null> {
  const { data, error } = await supabase
    .from('trouvetou_ads_performance')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[trouvetou-intelligence] ads perf error', error);
    return null;
  }
  return data;
}

export async function fetchTrouvetouConversionFunnel(
  supabase: SupabaseClient,
  establishmentId: string
): Promise<TrouvetouConversionFunnel | null> {
  const { data, error } = await supabase
    .from('trouvetou_conversion_funnel')
    .select('*')
    .eq('establishment_id', establishmentId)
    .maybeSingle();

  if (error) {
    console.error('[trouvetou-intelligence] funnel error', error);
    return null;
  }
  return data;
}

export async function computeTrouvetouConversionRate(
  supabase: SupabaseClient,
  establishmentId: string,
  days = 90
): Promise<number | null> {
  const { data, error } = await supabase.rpc('compute_trouvetou_conversion_rate', {
    p_establishment_id: establishmentId,
    p_days: days,
  });

  if (error) {
    console.error('[trouvetou-intelligence] conversion rate error', error);
    return null;
  }
  return (data as number | null) ?? null;
}
