import type { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// UUID fixes pour les tests E2E (cohérents avec seed.sql)
const ETAB_ID = '11111111-0000-0000-0000-000000000001';
const LEVEL_ID = '11111111-0000-0000-0000-000000000101';
const SECTION_ID = '11111111-0000-0000-0000-000000000201';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!key) {
    console.warn('[e2e/global-setup] SUPABASE_SERVICE_ROLE_KEY non défini — les tests E2E seront ignorer.');
    return;
  }

  const admin = createClient(url, key, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });

  // Nettoie + recrée l'établissement de test
  await admin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('student_fees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('sections').delete().eq('id', SECTION_ID);
  await admin.from('levels').delete().eq('id', LEVEL_ID);
  await admin.from('establishments').delete().eq('id', ETAB_ID);

  // Crée l'établissement de test
  await admin.from('establishments').insert({
    id: ETAB_ID,
    name: 'École Test E2E',
    city: 'Abidjan',
    description: 'Établissement dédié aux tests E2E Playwright',
    school_type: 'primaire',
    reservation_fee_amount: 5000,
    reservation_hold_hours: 72,
  });

  // Crée un niveau (CP1)
  await admin.from('levels').insert({
    id: LEVEL_ID,
    establishment_id: ETAB_ID,
    name: 'CP1',
    rank: 1,
  });

  // Crée une section avec capacité généreuse (20 places, 0 occupées)
  await admin.from('sections').insert({
    id: SECTION_ID,
    level_id: LEVEL_ID,
    name: 'CP1-A',
    capacity: 20,
    seats_taken: 0,
  });

  // Crée un profil admin de test
  const { error: adminErr } = await admin.from('profiles').upsert({
    id: '11111111-0000-0000-0000-000000000301',
    full_name: 'Admin Test',
    email: 'admin@test.schooly',
    role: 'admin',
    establishment_id: ETAB_ID,
  });

  if (adminErr) {
    console.warn('[e2e/global-setup] Erreur création profil admin:', adminErr.message);
  }

  // Persiste les IDs pour les tests
  writeFileSync(
    join(__dirname, '..', 'test-ids.json'),
    JSON.stringify(
      {
        establishmentId: ETAB_ID,
        levelId: LEVEL_ID,
        sectionId: SECTION_ID,
        establishmentUrl: `/etablissement/${ETAB_ID}`,
      },
      null,
      2,
    ),
  );

  console.log('[e2e/global-setup] Données de testseedées pour l\'établissement', ETAB_ID);
}
