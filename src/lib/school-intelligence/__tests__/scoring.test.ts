import { describe, it, expect } from 'vitest';
import {
  healthScoreLabel,
  healthScoreColor,
  isHealthy,
  reservationConfirmationRate,
  reservationNoShowRate,
  capacityUtilization,
  hasCapacityPressure,
  paymentRiskLabel,
  hasPaymentIssues,
} from '@/lib/school-intelligence/scoring';
import type { SchoolHealthOverview } from '@/lib/school-intelligence/scoring';

function mockOverview(overrides: Partial<SchoolHealthOverview> = {}): SchoolHealthOverview {
  return {
    establishment_id: 'e1',
    establishment_name: 'École Test',
    city: 'Abidjan',
    school_type: 'primaire',
    auth_users_total: 10,
    auth_active_sessions_24h: 3,
    auth_orphan_profiles: 0,
    auth_banned_users: 0,
    auth_duplicate_account_groups: 0,
    staff_total: 8,
    staff_admin_count: 1,
    staff_teacher_count: 5,
    staff_secretariat_count: 1,
    staff_censeur_count: 1,
    parent_count: 120,
    res_pending_payment_count: 5,
    res_reserved_count: 4,
    res_confirmed_count: 10,
    res_expired_count: 2,
    res_cancelled_count: 1,
    res_waitlisted_count: 3,
    res_rejected_fraud_count: 0,
    res_total_count: 25,
    res_avg_parent_trust_score: 75,
    res_high_fraud_risk_count: 0,
    res_waitlist_max_position: 3,
    total_sections: 12,
    total_capacity: 360,
    total_seats_taken: 280,
    fill_rate_pct: 78,
    total_seats_available: 80,
    full_sections_count: 2,
    low_fill_sections_count: 1,
    total_levels: 6,
    students_total: 280,
    students_new_30d: 12,
    students_new_7d: 3,
    students_avg_age: 9.5,
    pay_total_collected: 5000000,
    pay_total_pending: 500000,
    pay_total_remaining: 2000000,
    pay_recovery_rate_pct: 71,
    pay_confirmed_count: 45,
    pay_pending_count: 8,
    pay_failed_count: 2,
    fees_overdue_count: 15,
    pay_high_risk_count: 3,
    docs_avg_completeness_pct: 85,
    docs_total_required: 1400,
    docs_total_validated: 1190,
    docs_total_missing: 30,
    docs_students_incomplete: 20,
    grades_total_count: 560,
    grades_overall_average: 13.5,
    grades_avg_30d: 14.0,
    grades_recorded_7d: 20,
    students_at_risk_count: 8,
    students_at_risk_high: 2,
    students_at_risk_medium: 6,
    beh_total_notes_30d: 15,
    beh_incidents_30d: 3,
    beh_a_surveiller_30d: 12,
    msg_total_30d: 40,
    msg_unread_count: 5,
    msg_read_rate_pct: 87,
    att_total_records_30d: 600,
    att_present_count_30d: 540,
    att_absent_count_30d: 60,
    att_rate_pct_30d: 90,
    int_total_beds: 100,
    int_occupied_beds: 80,
    int_free_beds: 20,
    int_occupancy_rate_pct: 80,
    int_incidents_7d: 2,
    int_incidents_30d: 8,
    int_grave_open_incidents: 0,
    int_visits_today: 3,
    sec_total_pending_actions: 12,
    sec_students_incomplete_docs: 20,
    sec_pending_payment_count: 5,
    sec_reservations_today: 6,
    students_by_level: { CP1: 40, CP2: 45, CE1: 45, CE2: 40, CM1: 45, CM2: 40 },
    ...overrides,
  };
}

describe('school-intelligence/scoring', () => {
  describe('healthScoreLabel', () => {
    it('classifie le score de santé', () => {
      expect(healthScoreLabel(95)).toBe('Sain');
      expect(healthScoreLabel(80)).toBe('Sain');
      expect(healthScoreLabel(79)).toBe('Moyen');
      expect(healthScoreLabel(60)).toBe('Moyen');
      expect(healthScoreLabel(59)).toBe('Fragile');
      expect(healthScoreLabel(40)).toBe('Fragile');
      expect(healthScoreLabel(39)).toBe('Critique');
      expect(healthScoreLabel(0)).toBe('Critique');
    });
  });

  describe('healthScoreColor', () => {
    it('retourne le niveau de couleur', () => {
      expect(healthScoreColor(85)).toBe('healthy');
      expect(healthScoreColor(79)).toBe('warning');
      expect(healthScoreColor(30)).toBe('critical');
    });
  });

  describe('isHealthy', () => {
    it('true si score >= 70', () => {
      expect(isHealthy(70)).toBe(true);
      expect(isHealthy(71)).toBe(true);
      expect(isHealthy(69)).toBe(false);
      expect(isHealthy(0)).toBe(false);
    });
  });

  describe('reservationConfirmationRate', () => {
    it('calcule le taux de conversion tunnel', () => {
      const r = mockOverview();
      // pending(5) + reserved(4) + confirmed(10) = 19 ; confirmed = 10
      expect(reservationConfirmationRate(r)).toBe(Math.round((100 * 10) / 19));
    });

    it('retourne 0 si pas de réservations actives', () => {
      const r = mockOverview({
        res_pending_payment_count: 0,
        res_reserved_count: 0,
        res_confirmed_count: 0,
      });
      expect(reservationConfirmationRate(r)).toBe(0);
    });
  });

  describe('reservationNoShowRate', () => {
    it('calcule le taux de no-show sur les réservées', () => {
      const r = mockOverview();
      // reserved(4), expired(2) → 50%
      expect(reservationNoShowRate(r)).toBe(50);
    });

    it('retourne 0 si aucune réservation reservée', () => {
      const r = mockOverview({ res_reserved_count: 0, res_expired_count: 2 });
      expect(reservationNoShowRate(r)).toBe(0);
    });
  });

  describe('capacityUtilization', () => {
    it('calcule le taux d\'occupation', () => {
      const r = mockOverview();
      // 280/360 → 78%
      expect(capacityUtilization(r)).toBe(78);
    });

    it('retourne 0 si aucune capacité', () => {
      const r = mockOverview({ total_capacity: 0, total_seats_taken: 0 });
      expect(capacityUtilization(r)).toBe(0);
    });
  });

  describe('hasCapacityPressure', () => {
    it('true si sections pleines ou saturation >= 95%', () => {
      expect(hasCapacityPressure(mockOverview({ full_sections_count: 2 }))).toBe(true);
      expect(hasCapacityPressure(mockOverview({ fill_rate_pct: 96, full_sections_count: 0 }))).toBe(true);
    });

    it('false si tout va bien', () => {
      expect(hasCapacityPressure(mockOverview({ full_sections_count: 0, fill_rate_pct: 70 }))).toBe(false);
    });
  });

  describe('paymentRiskLabel', () => {
    it('classifie le risque de paiement', () => {
      expect(paymentRiskLabel(60)).toBe('high');
      expect(paymentRiskLabel(100)).toBe('high');
      expect(paymentRiskLabel(30)).toBe('medium');
      expect(paymentRiskLabel(29)).toBe('low');
      expect(paymentRiskLabel(0)).toBe('low');
    });
  });

  describe('hasPaymentIssues', () => {
    it('true si impayés, risque ou solde dû', () => {
      expect(hasPaymentIssues(mockOverview())).toBe(true);
      expect(hasPaymentIssues(
        mockOverview({
          fees_overdue_count: 0,
          pay_high_risk_count: 0,
          pay_total_remaining: 0,
        }),
      )).toBe(false);
    });
  });
});
