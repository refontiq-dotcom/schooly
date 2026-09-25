import { describe, expect, it } from "vitest"
import * as admissionsActions from "./actions"

const ADMISSIONS_ACTION_EXPORTS = [
  "completeCounterEnrollment",
  "createEnrollment",
  "createFinancialProfile",
  "createGuardian",
  "createPreEnrollment",
  "createStudent",
  "getDirectorySnapshot",
  "getEnrollmentQuote",
  "getEnrollments",
  "getFinancialProfiles",
  "getGuardians",
  "getPreEnrollmentByCode",
  "getPreEnrollments",
  "getStudents",
  "validatePreEnrollment",
]

describe("façade admissions", () => {
  it("conserve tous les exports Server Action historiques", () => {
    expect(Object.keys(admissionsActions).sort()).toEqual([...ADMISSIONS_ACTION_EXPORTS].sort())
  })
})
