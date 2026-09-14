import { describe, it, expect } from 'vitest';
import {
  isAlertCritical,
  summarizeFillStatus,
  colorForFillStatus,
} from '@/lib/classes-intelligence/scoring';
import type { ClassBalanceAlert, FillStatus } from '@/lib/classes-intelligence/scoring';

describe('classes-intelligence/scoring', () => {
  describe('summarizeFillStatus', () => {
    it('full à 100%', () => {
      expect(summarizeFillStatus(100)).toBe('full');
      expect(summarizeFillStatus(120)).toBe('full');
    });
    it('almost_full entre 90 et 99', () => {
      expect(summarizeFillStatus(90)).toBe('almost_full');
      expect(summarizeFillStatus(95)).toBe('almost_full');
    });
    it('normal entre 50 et 89', () => {
      expect(summarizeFillStatus(50)).toBe('normal');
      expect(summarizeFillStatus(75)).toBe('normal');
    });
    it('low en dessous de 50', () => {
      expect(summarizeFillStatus(49)).toBe('low');
      expect(summarizeFillStatus(0)).toBe('low');
    });
  });

  describe('isAlertCritical', () => {
    it('true si alert_level=critical', () => {
      const alert: ClassBalanceAlert = {
        section_id: 's1',
        level_id: 'l1',
        establishment_id: 'e1',
        level_name: '6ème',
        section_name: '6ème1',
        fill_rate_pct: 100,
        fill_status: 'full',
        seats_available: 0,
        alert_level: 'critical',
      };
      expect(isAlertCritical(alert)).toBe(true);
    });

    it('false sinon', () => {
      const alert: ClassBalanceAlert = {
        section_id: 's1',
        level_id: 'l1',
        establishment_id: 'e1',
        level_name: '6ème',
        section_name: '6ème1',
        fill_rate_pct: 30,
        fill_status: 'low',
        seats_available: 20,
        alert_level: 'info',
      };
      expect(isAlertCritical(alert)).toBe(false);
    });
  });

  describe('colorForFillStatus', () => {
    it('retourne la bonne couleur', () => {
      const expected: Record<FillStatus, string> = {
        full: 'red',
        almost_full: 'orange',
        low: 'amber',
        normal: 'green',
        unknown: 'slate',
      };
      (Object.keys(expected) as FillStatus[]).forEach((s) => {
        expect(colorForFillStatus(s)).toBe(expected[s]);
      });
    });
  });
});
