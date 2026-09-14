import { describe, it, expect } from 'vitest';
import {
  completenessLabel,
  completenessColor,
  isWorkloadCritical,
} from '@/lib/secretariat-intelligence/scoring';
import type { SecretariatDailyActions } from '@/lib/secretariat-intelligence/scoring';

describe('secretariat-intelligence/scoring', () => {
  describe('completenessLabel', () => {
    it('traduit les statuts', () => {
      expect(completenessLabel('complete')).toBe('Complet');
      expect(completenessLabel('pending_validation')).toBe('En attente de validation');
      expect(completenessLabel('incomplete')).toBe('Incomplet');
    });
  });

  describe('completenessColor', () => {
    it('retourne la bonne couleur', () => {
      expect(completenessColor('complete')).toBe('green');
      expect(completenessColor('pending_validation')).toBe('amber');
      expect(completenessColor('incomplete')).toBe('red');
    });
  });

  describe('isWorkloadCritical', () => {
    it('true si total_pending_actions >= 20', () => {
      const row: SecretariatDailyActions = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        reservations_today: 10,
        pending_payment_count: 5,
        reserved_count: 5,
        payments_today: 8,
        payments_pending: 5,
        pending_amount: 50000,
        students_with_incomplete_docs: 5,
        total_pending_actions: 20,
      };
      expect(isWorkloadCritical(row)).toBe(true);
    });

    it('false sinon', () => {
      const row: SecretariatDailyActions = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        reservations_today: 2,
        pending_payment_count: 1,
        reserved_count: 1,
        payments_today: 1,
        payments_pending: 1,
        pending_amount: 1000,
        students_with_incomplete_docs: 2,
        total_pending_actions: 4,
      };
      expect(isWorkloadCritical(row)).toBe(false);
    });
  });
});
