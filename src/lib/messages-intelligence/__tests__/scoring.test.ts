import { describe, it, expect } from 'vitest';
import {
  isEngaged,
  engagementLabel,
  urgencyLabel,
  isUrgencyCritical,
} from '@/lib/messages-intelligence/scoring';

describe('messages-intelligence/scoring', () => {
  describe('isEngaged', () => {
    it('true si engaged', () => {
      expect(isEngaged('engaged')).toBe(true);
    });
    it('false sinon', () => {
      expect(isEngaged('normal')).toBe(false);
      expect(isEngaged('low_engagement')).toBe(false);
      expect(isEngaged('no_data')).toBe(false);
    });
  });

  describe('engagementLabel', () => {
    it('traduit tous les niveaux', () => {
      expect(engagementLabel('engaged')).toBe('Engagé');
      expect(engagementLabel('normal')).toBe('Normal');
      expect(engagementLabel('low_engagement')).toBe('Faible');
      expect(engagementLabel('no_data')).toBe('Aucune donnée');
    });
  });

  describe('urgencyLabel', () => {
    it('traduit les sources', () => {
      expect(urgencyLabel('keyword')).toBe('Corps du message');
      expect(urgencyLabel('keyword_subject')).toBe('Sujet');
      expect(urgencyLabel('late_only')).toBe('En retard');
    });
  });

  describe('isUrgencyCritical', () => {
    it('true si >= 72h', () => {
      expect(isUrgencyCritical(72)).toBe(true);
      expect(isUrgencyCritical(100)).toBe(true);
    });
    it('false sinon', () => {
      expect(isUrgencyCritical(50)).toBe(false);
      expect(isUrgencyCritical(0)).toBe(false);
    });
  });
});
