import { describe, it, expect } from 'vitest';
import {
  computeRiskLevel,
  summarizeOccupancy,
  isDashboardCritical,
} from '@/lib/internat-intelligence/scoring';
import type { InternatDashboardRow } from '@/lib/internat-intelligence/scoring';

describe('internat-intelligence/scoring', () => {
  describe('computeRiskLevel', () => {
    it('retourne critical si un incident grave est ouvert', () => {
      expect(
        computeRiskLevel({ openGrave: 1, incidents30d: 0, serious30d: 0 })
      ).toBe('critical');
    });

    it('retourne high si 3+ incidents sur 30j', () => {
      expect(
        computeRiskLevel({ openGrave: 0, incidents30d: 3, serious30d: 0 })
      ).toBe('high');
    });

    it('retourne medium si 2+ incidents sérieux sur 30j', () => {
      expect(
        computeRiskLevel({ openGrave: 0, incidents30d: 2, serious30d: 2 })
      ).toBe('medium');
    });

    it('retourne low si pas de critère déclenché', () => {
      expect(
        computeRiskLevel({ openGrave: 0, incidents30d: 1, serious30d: 1 })
      ).toBe('low');
    });
  });

  describe('summarizeOccupancy', () => {
    it('formate le ratio + pourcentage', () => {
      const row: InternatDashboardRow = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        total_beds: 100,
        occupied_beds: 75,
        free_beds: 20,
        maintenance_beds: 5,
        occupancy_rate_pct: 75,
        incidents_7d: 0,
        incidents_30d: 0,
        grave_open_incidents: 0,
        visits_today: 0,
      };
      expect(summarizeOccupancy(row)).toBe('75/100 (75%)');
    });
  });

  describe('isDashboardCritical', () => {
    it('true si au moins un incident grave ouvert', () => {
      const row: InternatDashboardRow = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        total_beds: 10,
        occupied_beds: 10,
        free_beds: 0,
        maintenance_beds: 0,
        occupancy_rate_pct: 100,
        incidents_7d: 1,
        incidents_30d: 1,
        grave_open_incidents: 1,
        visits_today: 0,
      };
      expect(isDashboardCritical(row)).toBe(true);
    });

    it('false sinon', () => {
      const row: InternatDashboardRow = {
        establishment_id: 'e1',
        establishment_name: 'Test',
        total_beds: 10,
        occupied_beds: 5,
        free_beds: 5,
        maintenance_beds: 0,
        occupancy_rate_pct: 50,
        incidents_7d: 0,
        incidents_30d: 0,
        grave_open_incidents: 0,
        visits_today: 0,
      };
      expect(isDashboardCritical(row)).toBe(false);
    });
  });
});
