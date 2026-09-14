import { test, expect } from '@playwright/test';
import { getTestIds } from './helpers/test-data';

test.describe('Flux de réservation', () => {
  const ids = getTestIds();

  test('page publique de l\'établissement charge et propose les niveaux', async ({ page }) => {
    await page.goto(ids.establishmentUrl);

    await expect(page).toHaveTitle(/École Test E2E/i);
    await expect(page.getByRole('heading', { name: /places disponibles/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /réserver une place/i })).toBeVisible();

    // Le niveau CP1 avec places disponibles doit être listé
    await expect(page.locator('select[name-level_id], select').first()).toContainText('CP1');
  });

  test('la création de réservation via l\'API aboutit à une réservation « reserved » avec QR code', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: {
        establishment_id: ids.establishmentId,
        level_id: ids.levelId,
        student_full_name: 'Jean Test E2E',
        student_birthdate: '2018-05-10',
        parent_full_name: 'Parent Test E2E',
        parent_phone: `+22507000009${Math.floor(Math.random() * 90) + 10}`,
        parent_email: 'parent.test.e2e@example.com',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.reservation).toBeDefined();
    expect(body.reservation.status).toBe('reserved');
    expect(body.reservation.qr_code_token).toBeTruthy();
    expect(body.reservation.section_id).toBeTruthy();
  });

  test('le formulaire de réservation publique redirige vers la page de confirmation', async ({ page }) => {
    await page.goto(ids.establishmentUrl);

    await page.locator('input[name="student_full_name"]').fill('Marie Test E2E');
    await page.locator('input[name="student_birthdate"]').fill('2018-03-15');
    await page.locator('input[name="parent_full_name"]').fill('Maman Test');
    await page.locator('input[name="parent_phone"]').fill('+2250700000877');
    await page.locator('input[name="parent_email"]').fill('maman.test.e2e@example.com');

    await page.getByRole('button', { name: /continuer vers le paiement/i }).click();

    // Redirection vers /reservation/confirmation/[id]
    await page.waitForURL(/\/reservation\/confirmation\/.+/);
    const url = new URL(page.url()).pathname;
    const reservationId = url.split('/').pop()!;
    expect(reservationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
