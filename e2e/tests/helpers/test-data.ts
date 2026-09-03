import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TestIds {
  establishmentId: string;
  levelId: string;
  sectionId: string;
  establishmentUrl: string;
}

const idsPath = join(process.cwd(), 'e2e', 'test-ids.json');

export function getTestIds(): TestIds {
  try {
    return JSON.parse(readFileSync(idsPath, 'utf-8')) as TestIds;
  } catch {
    return {
      establishmentId: '11111111-0000-0000-0000-000000000001',
      levelId: '11111111-0000-0000-0000-000000000101',
      sectionId: '11111111-0000-0000-0000-000000000201',
      establishmentUrl: '/etablissement/11111111-0000-0000-0000-000000000001',
    };
  }
}
