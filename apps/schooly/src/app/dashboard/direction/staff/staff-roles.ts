export const STAFF_ROLE_CODES = [
  "direction",
  "secretariat",
  "compta",
  "caisse",
  "professeur",
  "surveillance",
] as const

export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number]

export const STAFF_ROLE_LABELS: Record<StaffRoleCode, string> = {
  direction: "Direction",
  secretariat: "Secrétariat",
  compta: "Comptabilité",
  caisse: "Caisse",
  professeur: "Enseignant",
  surveillance: "Surveillance",
}

export type StaffMember = {
  id: string
  user_id: string
  role_code: StaffRoleCode
  is_active: boolean
  created_at: string
  full_name: string
  email: string | null
  phone: string | null
}

export function isStaffRole(value: string): value is StaffRoleCode {
  return (STAFF_ROLE_CODES as readonly string[]).includes(value)
}
