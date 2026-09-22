// Fixtures de test partagées par les écrans services. Les valeurs par
// défaut forment un jeu cohérent : un interne de 6e B logé chambre 101
// du Pavillon Nord, abonné au plan mensuel de cantine.
import type { CanteenMenu, DormRoom, Dormitory, EnrollmentOption, ServiceSub } from "./types"

export function makeRoom(overrides: Partial<DormRoom> = {}): DormRoom {
  return { id: "r1", room_number: "201", capacity: 4, ...overrides }
}

export function makeDormitory(overrides: Partial<Dormitory> = {}): Dormitory {
  return {
    id: "d1",
    name: "Pavillon Nord",
    gender_restriction: "mixed",
    capacity: 60,
    supervisor_name: null,
    dorm_rooms: [],
    ...overrides,
  }
}

export function makeEnrollment(overrides: Partial<EnrollmentOption> = {}): EnrollmentOption {
  return {
    id: "e1",
    students: { last_name: "Kouadio", first_name: "Aya" },
    classes: { name: "6e B" },
    ...overrides,
  }
}

export function makeSub(overrides: Partial<ServiceSub> = {}): ServiceSub {
  return {
    id: "s1",
    status: "active",
    amount_cfa: 50_000,
    start_date: "2026-01-15",
    plan_type: null,
    enrollments: makeEnrollment(),
    dorm_rooms: { room_number: "101", dormitories: { name: "Pavillon Nord" } },
    ...overrides,
  }
}

export function makeMenu(overrides: Partial<CanteenMenu> = {}): CanteenMenu {
  return {
    id: "m1",
    date: "2026-01-14",
    meal_type: "lunch",
    description: "Riz gras au poulet",
    ...overrides,
  }
}
