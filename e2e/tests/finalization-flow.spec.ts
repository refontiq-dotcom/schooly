import { test, expect } from '@playwright/test';
import { getAdminClient } from './helpers/supabase';
import { getTestIds } from './helpers/test-data';

test.describe('Flux de finalisation (scannage QR)', () => {
  const ids = getTestIds();

  let reservationId: string;
  let qrToken: string;

  test.beforeAll(async () => {
    const admin = getAdminClient();

    // 1) Crée une réservation (statut = reserved, seat dispo)
    const { data: resData, error: resErr } = await admin.rpc('create_reservation_smart', {
      p_establishment_id: ids.establishmentId,
      p_level_id: ids.levelId,
      p_student_full_name: 'Finalisation Test E2E',
      p_student_birthdate: '2017-06-20',
      p_parent_full_name: 'Parent Finalisation',
      p_parent_phone: '+2250700000688',
      p_parent_email: 'finalisation.test@example.com',
    });
    if (resErr) throw resErr;
    reservationId = resData[0].id;
    qrToken = resData[0].qr_code_token;

    // 2) Vérifie que le token QR est exploitable en base
    const { data: lookup, error: lookupErr } = await admin
      .from('reservations')
      .select('*')
      .eq('qr_code_token', qrToken)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    expect(lookup.id).toBe(reservationId);
  });

  test('le lookup par QR token résout la bonne réservation', async () => {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('reservations')
      .select('*, establishments(name), levels(name), sections(name)')
      .eq('qr_code_token', qrToken)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.student_full_name).toBe('Finalisation Test E2E');
    expect(data?.establishments?.name).toBe('École Test E2E');
  });

  test('finalize_reservation crée l\'élève et passe la réservation à confirmed', async () => {
    const admin = getAdminClient();

    // La fonction finalize_reservation(uuid, uuid, uuid) est security definer sans check auth.uid()
    const { data, error } = await admin.rpc('finalize_reservation', {
      p_reservation_id: reservationId,
      p_section_id: null,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    expect(data[0].reservation_id).toBe(reservationId);
    expect(data[0].student_id).toBeTruthy();
    expect(data[0].section_id).toBeTruthy();

    // Vérifie que l'élève a bien été créé et lié à la réservation
    const { data: student, error: studentErr } = await admin
      .from('students')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle();

    expect(studentErr).toBeNull();
    expect(student).not.toBeNull();
    expect(student?.full_name).toBe('Finalisation Test E2E');
    expect(student?.section_id).toBe(data[0].section_id);

    // Vérifie que la réservation est passée à 'confirmed'
    const { data: updated, error: updErr } = await admin
      .from('reservations')
      .select('status')
      .eq('id', reservationId)
      .maybeSingle();

    expect(updErr).toBeNull();
    expect(updated?.status).toBe('confirmed');
  });
});
