import { describe, it, expect } from 'vitest';
import {
  workloadLabel,
  isWorkloadHigh,
  pendingGradeUrgency,
} from '@/lib/teacher-intelligence/scoring-v2';
import type { TeacherWorkloadSummary } from '@/lib/teacher-intelligence/scoring-v2';

describe('teacher-intelligence/v2', () => {
  describe('workloadLabel', () => {
    it('traduit les niveaux', () => {
      expect(workloadLabel('high')).toBe('Charge élevée');
      expect(workloadLabel('normal')).toBe('Charge normale');
      expect(workloadLabel('low')).toBe('Charge faible');
      expect(workloadLabel('none')).toBe('Aucune classe');
    });
  });

  describe('isWorkloadHigh', () => {
    it('true si workload_level=high', () => {
      const w: TeacherWorkloadSummary = {
        teacher_id: 't1',
        establishment_id: 'e1',
        teacher_name: 'M. Dupont',
        classes_count: 7,
        subjects_count: 3,
        class_subject_pairs: 10,
        homeroom_students: 30,
        grades_recorded_7d: 12,
        attendance_records_7d: 8,
        workload_level: 'high',
      };
      expect(isWorkloadHigh(w)).toBe(true);
    });

    it('false sinon', () => {
      const w: TeacherWorkloadSummary = {
        teacher_id: 't1',
        establishment_id: 'e1',
        teacher_name: 'M. Dupont',
        classes_count: 2,
        subjects_count: 1,
        class_subject_pairs: 2,
        homeroom_students: 0,
        grades_recorded_7d: 1,
        attendance_records_7d: 1,
        workload_level: 'normal',
      };
      expect(isWorkloadHigh(w)).toBe(false);
    });
  });

  describe('pendingGradeUrgency', () => {
    it('urgent si >= 8 jours', () => {
      expect(pendingGradeUrgency(8)).toBe('urgent');
      expect(pendingGradeUrgency(10)).toBe('urgent');
    });
    it('soon si entre 5 et 7', () => {
      expect(pendingGradeUrgency(5)).toBe('soon');
      expect(pendingGradeUrgency(7)).toBe('soon');
    });
    it('ok si < 5', () => {
      expect(pendingGradeUrgency(3)).toBe('ok');
      expect(pendingGradeUrgency(4)).toBe('ok');
    });
  });
});
