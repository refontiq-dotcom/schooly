import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from './helpers/supabase';
import { getTestIds } from './helpers/test-data';

test.describe('Flux de paiement / confirmation', () => {
  const ids = getTestIds();
  let admin: SupabaseClient;

  let reservationId: string;

  test.beforeAll(async () => {
    admin = getAdminClient();
    // Crée une réservation de test via l'API admin
    const { data, error } = await admin.rpc('create_reservation_smart', {
      p_establishment_id: ids.establishmentId,
      p_level_id: ids.levelId,
      p_student_full_name: 'Paiement Test E2E',
      p_student_birthdate: '2018-01-01',
      p_parent_full_name: 'Parent Paiement',
      p_parent_phone: '+2250700000711',
      p_parent_email: 'paiement.test@example.com',
    });

    if (error) throw error;
    reservationId = data[0].id;
  });

  test('le bouton « Simuler le paiement » confirme la réservation (idempotent)', async ({ request }) => {
    // Première confirmation : appelle reserve_seat
    const res1 = await request.post(`/api/reservations/${reservationId}/confirm`, {
      data: { payment_reference: `SIM-${Date.now()}` },
    });

    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.reservation).toBeDefined();
    expect(body1.reservation.status).toBe('reserved');
    expect(body1.already_reserved).toBe(false);
  });

  test('une seconde confirmation est idempotente (already_reserved = true)', async ({ request }) => {
    const res = await request.post(`/api/reservations/${reservationId}/confirm`, {
      data: { payment_reference: `SIM-${Date.now()}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.already_reserved).toBe(true);
  });

  test('confirmer une réservation expirée échoue avec 409', async ({ request }) => {
    // Expire manuellement la réservation
    await admin
      .from('reservations')
      .update({ status: 'expired' })
      .eq('id', reservationId);

    const res = await request.post(`/api/reservations/${reservationId}/confirm`, {
      data: {},
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('EXPIRED');
  });
});
