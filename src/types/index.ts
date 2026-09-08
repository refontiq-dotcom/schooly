export type UserRole = "admin" | "professeur" | "secretariat" | "censeur" | "parent";

export type SchoolType = "primaire" | "college" | "lycee" | "professionnel" | "islamique";

export type ReservationStatus =
  | "pending_payment"
  | "reserved"
  | "finalized"
  | "cancelled"
  | "expired";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  establishment_id: string | null;
  created_at: string;
}

export interface Establishment {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  school_type: SchoolType | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  cover_image_url: string | null;
  reservation_fee_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Level {
  id: string;
  establishment_id: string;
  name: string;
  capacity: number;
  reserved_count: number;
  created_at: string;
}

export interface Section {
  id: string;
  level_id: string;
  name: string;
  capacity: number;
  created_at: string;
}

export interface Student {
  id: string;
  establishment_id: string;
  section_id: string | null;
  full_name: string;
  birthdate: string | null;
  parent_full_name: string;
  parent_phone: string;
  parent_email: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  establishment_id: string;
  level_id: string;
  student_full_name: string;
  student_birthdate: string | null;
  parent_full_name: string;
  parent_phone: string;
  parent_email: string | null;
  status: ReservationStatus;
  payment_reference: string | null;
  amount_paid: number | null;
  reservation_code: string | null;
  expires_at: string | null;
  created_at: string;
}
