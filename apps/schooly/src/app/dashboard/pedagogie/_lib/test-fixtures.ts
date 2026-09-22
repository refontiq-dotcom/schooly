// Fixtures de test du hub pédagogie. Les horodatages sont « naïfs »
// (sans suffixe Z) pour rester déterministes quel que soit le fuseau du
// runner : les valeurs par défaut décrivent une séance de 6e B en
// mathématiques, un devoir non publié et une décision d'admission.
import type { DecisionRow, EnrollmentListRow, HomeworkListRow, SessionRow } from "./types"

export function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    starts_at: "2026-01-12T07:10:00",
    ends_at: "2026-01-12T08:00:00",
    room: null,
    notes: null,
    class_id: "c1",
    classes: { id: "c1", name: "6e B" },
    subject_id: "m1",
    subjects: { id: "m1", name: "Mathématiques" },
    teacher_id: "u1",
    users: { full_name: "Konan Yao" },
    academic_year_id: "y1",
    ...overrides,
  }
}

export function makeHomework(overrides: Partial<HomeworkListRow> = {}): HomeworkListRow {
  return {
    id: "h1",
    title: "Exercices 12 à 15",
    description: "Réviser le chapitre sur les fractions",
    due_date: "2026-01-16T10:00:00",
    supports: null,
    is_published: true,
    class_id: "c1",
    classes: { id: "c1", name: "6e B" },
    subject_id: "m1",
    subjects: { id: "m1", name: "Mathématiques" },
    teacher_id: "u1",
    users: { full_name: "Konan Yao" },
    ...overrides,
  }
}

export function makeDecision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1",
    decision: "admitted",
    average: 12.5,
    observations: null,
    decided_by: "u2",
    decided_at: "2026-01-15T09:00:00",
    enrollment_id: "e1",
    enrollments: {
      id: "e1",
      students: { id: "st1", first_name: "Aya", last_name: "Kouadio" },
      classes: { id: "c1", name: "6e B" },
    },
    academic_year_id: "y1",
    academic_years: { label: "2025-2026" },
    ...overrides,
  }
}

export function makeEnrollmentRow(overrides: Partial<EnrollmentListRow> = {}): EnrollmentListRow {
  return {
    id: "e1",
    students: { id: "st1", first_name: "Aya", last_name: "Kouadio" },
    classes: { id: "c1", name: "6e B" },
    ...overrides,
  }
}
