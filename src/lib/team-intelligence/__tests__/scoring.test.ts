import { describe, it, expect } from 'vitest';
import {
  isCritical,
  staffingLabel,
  parentEngagementLabel,
} from '@/lib/team-intelligence/scoring';

describe('team-intelligence/scoring', () => {
  describe('isCritical', () => {
    it('true si critical ou inactive', () => {
      expect(isCritical('critical')).toBe(true);
      expect(isCritical('inactive')).toBe(true);
    });
    it('false sinon', () => {
      expect(isCritical('active')).toBe(false);
      expect(isCritical('low_activity')).toBe(false);
      expect(isCritical('never')).toBe(false);
    });
  });

  describe('staffingLabel', () => {
    it('traduit tous les statuts', () => {
      expect(staffingLabel('complete')).toBe('Complet');
      expect(staffingLabel('missing_admin')).toBe('Admin manquant');
      expect(staffingLabel('missing_teachers')).toBe('Aucun prof');
      expect(staffingLabel('missing_secretariat')).toBe('Secrétariat manquant');
    });
  });

  describe('parentEngagementLabel', () => {
    it('traduit tous les niveaux', () => {
      expect(parentEngagementLabel('engaged')).toBe('Engagé');
      expect(parentEngagementLabel('normal')).toBe('Normal');
      expect(parentEngagementLabel('silent')).toBe('Silencieux');
      expect(parentEngagementLabel('no_children')).toBe('Aucun enfant');
    });
  });
});
