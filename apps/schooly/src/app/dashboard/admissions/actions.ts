// Façade de compatibilité : les imports historiques restent stables.
// Les implémentations vivent désormais dans des modules serveur cohérents.
export { createPreEnrollment, getPreEnrollments, getPreEnrollmentByCode } from "./pre-enrollments"
export {
  getEnrollmentQuote,
  validatePreEnrollment,
  completeCounterEnrollment,
} from "./counter-enrollments"
export type { CounterEnrollmentResult } from "./_shared"
export { getGuardians, createGuardian, getStudents, createStudent } from "./people"
export { getEnrollments, createEnrollment } from "./enrollments"
export { getFinancialProfiles, createFinancialProfile } from "./financial-profiles"
export { getDirectorySnapshot } from "./directory"
export type { ActionResult } from "./_shared"
