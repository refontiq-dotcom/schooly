import { describe, it, expect } from 'vitest';
import {
  isAuthHealthy,
  hasOrphans,
  healthLabel,
  banLabel,
} from '@/lib/auth-health/scoring';
import type { AuthHealthSummary } from '@/lib/auth-health/scoring';

describe('auth-health/scoring', () => {
  function baseSummary(): AuthHealthSummary {
    return {
      consistent_accounts: 10,
      orphan_profiles: 0,
      auth_no_profile: 0,
      total_profiles: 10,
      total_auth_users: 10,
      health_status: 'healthy',
    };
  }

  describe('isAuthHealthy', () => {
    it('true si healthy', () => {
      const s = baseSummary();
      expect(isAuthHealthy(s)).toBe(true);
    });
    it('false sinon', () => {
      expect(isAuthHealthy({ ...baseSummary(), health_status: 'has_orphan_profiles' })).toBe(false);
      expect(isAuthHealthy({ ...baseSummary(), health_status: 'has_incomplete_signups' })).toBe(false);
    });
  });

  describe('hasOrphans', () => {
    it('true si > 0', () => {
      expect(hasOrphans({ ...baseSummary(), orphan_profiles: 1 })).toBe(true);
    });
    it('false si 0', () => {
      expect(hasOrphans(baseSummary())).toBe(false);
    });
  });

  describe('healthLabel', () => {
    it('traduit les statuts', () => {
      expect(healthLabel('healthy')).toBe('Sain');
      expect(healthLabel('has_orphan_profiles')).toBe('Profils orphelins');
      expect(healthLabel('has_incomplete_signups')).toBe('Inscriptions incomplètes');
    });
  });

  describe('banLabel', () => {
    it('traduit les statuts', () => {
      expect(banLabel('active')).toBe('Actif');
      expect(banLabel('banned')).toBe('Banni');
      expect(banLabel('ban_expired')).toBe('Sanction expirée');
    });
  });
});
