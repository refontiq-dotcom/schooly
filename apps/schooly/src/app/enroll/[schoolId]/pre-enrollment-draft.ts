export type PreEnrollmentDraft = {
  firstName: string
  lastName: string
  dateOfBirth: string
  birthCertificateNumber: string
  guardianName: string
  guardianPhone: string
  guardianRelation: string
  guardianRelationDetail: string
  sameEmergencyContact: boolean
  emergencyName: string
  emergencyPhone: string
  firstEnrollment: boolean
  previousSchool: string
  previousClass: string
  enrollmentType: string
  stateOrientation: string
  orientationNumber: string
  previousMatricule: string
  gradeLevelId: string
}

const STRING_FIELDS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "birthCertificateNumber",
  "guardianName",
  "guardianPhone",
  "guardianRelation",
  "guardianRelationDetail",
  "emergencyName",
  "emergencyPhone",
  "previousSchool",
  "previousClass",
  "enrollmentType",
  "stateOrientation",
  "orientationNumber",
  "previousMatricule",
  "gradeLevelId",
] as const satisfies ReadonlyArray<keyof PreEnrollmentDraft>

export function parsePreEnrollmentDraft(raw: string | null): Partial<PreEnrollmentDraft> | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    const textDraft = Object.fromEntries(
      STRING_FIELDS
        .filter((field) => typeof record[field] === "string")
        .map((field) => [field, record[field] as string])
    )
    return {
      ...textDraft,
      ...(typeof record.sameEmergencyContact === "boolean"
        ? { sameEmergencyContact: record.sameEmergencyContact }
        : {}),
      ...(typeof record.firstEnrollment === "boolean"
        ? { firstEnrollment: record.firstEnrollment }
        : {}),
    }
  } catch {
    return null
  }
}
