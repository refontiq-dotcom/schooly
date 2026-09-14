import { describe, it, expect } from 'vitest';
import {
  isConversionGood,
  isAdsLive,
  conversionLabel,
} from '@/lib/trouvetou-intelligence/scoring';
import type { TrouvetouAdsPerformance } from '@/lib/trouvetou-intelligence/scoring';

describe('trouvetou-intelligence/scoring', () => {
  describe('isConversionGood', () => {
    it('true si rate >= 50', () => {
      expect(isConversionGood(50)).toBe(true);
      expect(isConversionGood(80)).toBe(true);
    });
    it('false si rate < 50 ou null', () => {
      expect(isConversionGood(49)).toBe(false);
      expect(isConversionGood(null)).toBe(false);
    });
  });

  describe('isAdsLive', () => {
    it('true si currently_live_ads > 0', () => {
      const p: TrouvetouAdsPerformance = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        total_ads: 5,
        active_ads: 2,
        currently_live_ads: 1,
        expired_ads: 2,
        scheduled_ads: 1,
        next_start: null,
        latest_end: null,
      };
      expect(isAdsLive(p)).toBe(true);
    });

    it('false si aucune pub live', () => {
      const p: TrouvetouAdsPerformance = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        total_ads: 3,
        active_ads: 0,
        currently_live_ads: 0,
        expired_ads: 3,
        scheduled_ads: 0,
        next_start: null,
        latest_end: null,
      };
      expect(isAdsLive(p)).toBe(false);
    });
  });

  describe('conversionLabel', () => {
    it('retourne le bon label selon le taux', () => {
      expect(conversionLabel(null)).toBe('N/A');
      expect(conversionLabel(80)).toBe('Excellent');
      expect(conversionLabel(60)).toBe('Bon');
      expect(conversionLabel(30)).toBe('Moyen');
      expect(conversionLabel(10)).toBe('Faible');
    });
  });
});
