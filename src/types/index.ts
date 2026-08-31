export type UserRole = "admin" | "professeur" | "secretariat" | "censeur" | "parent";

export type ReservationStatus =
  | "pending_payment"
  | "reserved"
  | "confirmed"
  | "expired"
  | "cancelled";

export interface Establishment {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  cover_image_url: string | null;
  tour_360_url: string | null;
  reservation_fee_amount: number;
  reservation_hold_hours: number;
}

export interface LevelAvailability {
  level_id: string;
  establishment_id: string;
  level_name: string;
  total_capacity: number;
  total_taken: number;
  seats_available: number;
}

export interface Section {
  id: string;
  level_id: string;
  name: string;
  capacity: number;
  seats_taken: number;
}

export interface Reservation {
  id: string;
  establishment_id: string;
  level_id: string;
  section_id: string | null;
  student_full_name: string;
  student_birthdate: string | null;
  parent_full_name: string;
  parent_phone: string;
  parent_email: string | null;
  status: ReservationStatus;
  amount_paid: number;
  qr_code_token: string;
  expires_at: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  section_id: string;
  parent_phone: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  section_id: string;
  session_date: string;
  present: boolean;
  note: string | null;
}

export interface Grade {
  id: string;
  student_id: string;
  section_id: string;
  subject: string;
  evaluation_type: string;
  score: number;
  max_score: number;
  evaluation_date: string;
}
