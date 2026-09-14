import { describe, it, expect } from 'vitest';
import {
  isFullyOnboarded,
  getOnboardingStatus,
} from '@/lib/onboarding-intelligence/scoring';
import type { OnboardingProgress } from '@/lib/onboarding-intelligence/scoring';

describe('onboarding-intelligence/scoring', () => {
  describe('isFullyOnboarded', () => {
    it('true si completion_pct = 100', () => {
      const p: OnboardingProgress = {
        establishment_id: 'e1',
        name: 'Test',
        created_at: '2025-01-01',
        steps_completed: 10,
        steps_total: 10,
        completion_pct: 100,
        has_description: 1, has_cover: 1, has_tour: 1, has_fee_config: 1,
        has_levels: 1, has_sections: 1, has_teachers: 1, has_staff: 1,
        has_students: 1, is_published: 1,
        next_step: 'Configuration complète !',
      };
      expect(isFullyOnboarded(p)).toBe(true);
    });
    it('false sinon', () => {
      const p: OnboardingProgress = {
        establishment_id: 'e1',
        name: 'Test',
        created_at: '2025-01-01',
        steps_completed: 3,
        steps_total: 10,
        completion_pct: 30,
        has_description: 1, has_cover: 0, has_tour: 0, has_fee_config: 0,
        has_levels: 1, has_sections: 0, has_teachers: 0, has_staff: 0,
        has_students: 0, is_published: 0,
        next_step: 'Créer les sections par niveau',
      };
      expect(isFullyOnboarded(p)).toBe(false);
    });
  });

  describe('getOnboardingStatus', () => {
    it('complete à 100%', () => {
      const p = { completion_pct: 100 } as OnboardingProgress;
      expect(getOnboardingStatus(p)).toBe('complete');
    });
    it('pending à 0%', () => {
      const p = { completion_pct: 0 } as OnboardingProgress;
      expect(getOnboardingStatus(p)).toBe('pending');
    });
    it('in_progress entre 1 et 99', () => {
      const p = { completion_pct: 50 } as OnboardingProgress;
      expect(getOnboardingStatus(p)).toBe('in_progress');
    });
  });
});
